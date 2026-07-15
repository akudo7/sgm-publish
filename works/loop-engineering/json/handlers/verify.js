/**
 * Verify handler — 構造化出力で計画と実行結果のギャップを検出する。
 *
 * structuredOutput schema (loop-task.json) を基にフレームワークが withStructuredOutput を自動適用。
 * model.invoke() の返り値は既にパース済みオブジェクト { gaps: [...] }。
 *
 * LLMの判定に依存せず、messagesからツール呼び出しを照合して
 * 計画タスクの完了状況を判定する（自動判定 + LLM判定のマージ）。
 *
 * assistant メッセージのフィルタリングは runner.ts の wrapAssistantFilter で処理。
 */

const rawPlan = state.plan;
const planTasks = rawPlan?.tasks ?? [];
const planText = planTasks.length > 0
  ? JSON.stringify(planTasks, null, 2)
  : '(計画なし)';

// messagesから write_file の呼び出しを抽出
const writtenFiles = new Set();
const executedCommands = [];
const toolCallMessages = [];

for (const msg of state.messages) {
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    toolCallMessages.push(msg);
    for (const tc of msg.tool_calls) {
      const name = tc.function?.name || tc.name || '';
      let args = {};
      try {
        args = typeof tc.args === 'string' ? JSON.parse(tc.args) : (tc.args || tc.arguments || {});
      } catch {
        args = tc.args || tc.arguments || {};
      }
      if (name === 'write_file') {
        writtenFiles.add(args.file_path);
      }
      if (name === 'bash_command') {
        executedCommands.push(args.command);
      }
    }
  }
}

// 計画の各タスクが完了したか判定（自動判定）
const gaps = [];

for (const task of planTasks) {
  const taskId = task.id;
  const taskFiles = task.files ?? [];
  const taskDesc = task.description ?? '';
  const descLower = taskDesc.toLowerCase();

  // タスクにファイルが指定されている場合
  if (taskFiles.length > 0) {
    const allFilesDone = taskFiles.every((fp) => {
      if (fp.includes('*')) {
        const basePattern = fp.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.');
        const regex = new RegExp(basePattern);
        return Array.from(writtenFiles).some((f) => regex.test(f));
      }
      return writtenFiles.has(fp) || Array.from(writtenFiles).some((f) => f.startsWith(fp + '/'));
    });

    if (!allFilesDone) {
      const missingFiles = taskFiles.filter((fp) => {
        if (fp.includes('*')) {
          const basePattern = fp.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.');
          const regex = new RegExp(basePattern);
          return !Array.from(writtenFiles).some((f) => regex.test(f));
        }
        return !writtenFiles.has(fp) && !Array.from(writtenFiles).some((f) => f.startsWith(fp + '/'));
      });
      gaps.push({
        task_id: taskId,
        description: `${taskDesc} — 未完了: ${missingFiles.join(', ')}`,
        status: '未完成',
      });
      continue;
    }
  }

  // ファイル指定がないタスクは bash_command の実行結果で判定
  if (taskFiles.length === 0) {
    const testKeywords = ['npm test', 'jest', 'npm run test'];
    const hasTestExec = executedCommands.some((cmd) => testKeywords.some((kw) => cmd.includes(kw)));

    const buildKeywords = ['npm install', 'yarn install', 'npm run build', 'tsc', 'webpack'];
    const hasBuildExec = executedCommands.some((cmd) => buildKeywords.some((kw) => cmd.includes(kw)));

    const startKeywords = ['npm start', 'node ', 'yarn start'];
    const hasStartExec = executedCommands.some((cmd) => startKeywords.some((kw) => cmd.includes(kw)));

    if (descLower.includes('test') && !hasTestExec) {
      gaps.push({
        task_id: taskId,
        description: `${taskDesc} — テストコマンドが実行されていない`,
        status: '未完成',
      });
    } else if (descLower.includes('install') && !hasBuildExec) {
      gaps.push({
        task_id: taskId,
        description: `${taskDesc} — インストールコマンドが実行されていない`,
        status: '未完成',
      });
    } else if ((descLower.includes('start') || descLower.includes('起動')) && !hasStartExec) {
      gaps.push({
        task_id: taskId,
        description: `${taskDesc} — 起動確認コマンドが実行されていない`,
        status: '未完成',
      });
    }
  }
}

if (process.env.LOOP_DEBUG_VERIFY === '1') {
console.error(`[verify] DEBUG: planTasks=${planTasks.length}, writtenFiles=${writtenFiles.size}, gaps=${gaps.length}, messages=${state.messages.length}`);
console.error(`[verify] DEBUG: last 3 messages types:`, state.messages.slice(-3).map(m => `${m.type || m._getType?.() || m.role}${m.tool_calls ? ' [tool_calls]' : ''}`).join(', '));
console.error(`[verify] DEBUG: loop_count=${state.loop_count}`);
console.error(`[verify] DEBUG: autoGap task_ids=[${gaps.map(g=>g.task_id).join(',')}]`);
}

// withStructuredOutput 化の model は wrapAssistantFilter を経由しないため、
// 末尾の assistant/AI メッセージを strip してから LlamaCpp に渡す（prefill+thinking 競合回避）
// 過去の tool メッセージは自動判定用（writtenFiles等）に必要だが、
// モデルに渡すのは最新 10 件に制限して文脈溢れを防ぐ
const MAX_TOOL_MSGS = 10;
const aiTypes = new Set(['ai', 'assistant']);
const aiMsgs = [];
const toolMsgs = [];
const otherMsgs = [];
for (const m of state.messages) {
  const t = m?._getType?.() || m?.type || m?.role || '';
  if (t === 'ai' || t === 'assistant') {
    aiMsgs.push(m);
  } else if (t === 'tool') {
    toolMsgs.push(m);
  } else {
    otherMsgs.push(m);
  }
}
// 末尾の AI メッセージを strip（直前の execute 応答 / prefill+thinking 競合回避）
const aiToKeep = aiMsgs.slice(0, -1);

// aiToKeep に含まれる AI メッセージの tool_call ID セットを作成し、
// その ID を持つ ToolMessage のみを保持する。
// 末尾 AI を strip した結果、対応する ToolMessage が孤立して
// llama-server に 400 エラーを引き起こすのを防ぐ。
const keptToolCallIds = new Set();
for (const m of aiToKeep) {
  for (const tc of (m.tool_calls || [])) {
    if (tc.id) keptToolCallIds.add(tc.id);
  }
}
const validToolMsgs = toolMsgs.filter(m => {
  const tcId = m.tool_call_id;
  return !tcId || keptToolCallIds.has(tcId);
});
const recentToolMsgs = validToolMsgs.slice(-MAX_TOOL_MSGS);
const stripLastAi = [...otherMsgs, ...aiToKeep, ...recentToolMsgs];
if (process.env.LOOP_DEBUG_VERIFY === '1') {
console.error(`[verify] Kept ${otherMsgs.length} other + ${aiToKeep.length} ai + ${recentToolMsgs.length} tool = ${stripLastAi.length} msgs (removed ${state.messages.length - stripLastAi.length})`);
}
if (process.env.LOOP_DEBUG_VERIFY === '1') {
console.error(`[verify] Sent ${stripLastAi.length} messages to verify_model (stripped ${state.messages.length - stripLastAi.length} trailing AI msgs)`);
console.error(`[verify] Calling model.invoke()...`);
}

let llmResult = { gaps: [] };
try {
  const response = await model.invoke(stripLastAi);
  if (process.env.LOOP_DEBUG_VERIFY === '1') {
  console.error(`[verify] model.invoke() returned: type=${typeof response}, hasGaps=${Array.isArray(response?.gaps)}`);
  }

  // Extract gaps from response — handle both structured output (object) and string (natural language)
  if (response && typeof response === 'object') {
    // Structured output: already parsed
    if (Array.isArray(response.gaps)) {
      llmResult = response;
    } else if (response.content && typeof response.content === 'string') {
      // AIMessage with content — try to parse JSON
      try {
        llmResult = JSON.parse(response.content);
        if (!Array.isArray(llmResult.gaps)) llmResult = { gaps: [] };
      } catch { llmResult = { gaps: [] }; }
    }
  } else if (typeof response === 'string') {
    // Plain string response — try to parse JSON
    try {
      llmResult = JSON.parse(response);
      if (!Array.isArray(llmResult.gaps)) llmResult = { gaps: [] };
    } catch { llmResult = { gaps: [] }; }
  }
} catch (err) {
  if (process.env.LOOP_DEBUG_VERIFY === '1') {
  console.error(`[verify] model.invoke() failed: ${err?.message || String(err)}. Using auto-gaps only.`);
  }
  llmResult = { gaps: [] };
}

// 自動判定のギャップ + LLM判定のギャップをマージ（重複除外）
const autoGapKeys = new Set(gaps.map((g) => g.task_id));
const mergedGaps = [
  ...gaps,
  ...(llmResult.gaps || []).filter((g) => !autoGapKeys.has(g.task_id)),
];

// 構造化出力結果を AIMessage として state に追加
const aiMsg = new AIMessage({
  content: JSON.stringify(llmResult, null, 2),
  additional_kwargs: { structured_output: llmResult },
});

// gaps フィールドに配列を返す（reducer: (x,y)=>y）
return { messages: [aiMsg], gaps: mergedGaps };
