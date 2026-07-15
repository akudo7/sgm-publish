async (state, model, tools) => {
  const fs = require('fs');
  const path = require('path');
  let _r = process.cwd();
  while (_r !== path.dirname(_r) && !fs.existsSync(path.join(_r, 'package.json'))) {
    _r = path.dirname(_r);
  }
  const baseSystemPrompt = fs.readFileSync(path.join(_r, 'works/sgm-consulting-v2/integration/prompts/consult_prompt.txt'), 'utf-8');
  const ALLOWED = ['read_file', 'web_fetch', 'write_todos', 'read_todos', 'grep_search'];
  const filteredTools = tools.filter(t => ALLOWED.includes(t.name));
  model = model.bindTools ? model.bindTools(filteredTools) : model;
  if ((state.turn_count || 0) >= 5) {
    console.log('[respond] turn_count:', state.turn_count, '— immediate escalation at round 6');
    return { messages: [], answer: '', escalated: true, turn_count: (state.turn_count || 0) + 1 };
  }
  const allMsgs = state.messages || [];
  const lastUserMsg = [...allMsgs].reverse().find(m => m.role === 'user' || m._getType?.() === 'human' || m.type === 'human');
  const questionText = lastUserMsg ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)) : 'ご質問をお知らせください。';

  // Server-side: read docs before model invocation (cache in state to avoid re-read on each turn)
  // Phase 2-1: Include key docs (QUICK-START, API, FEATURES) so the model doesn't call read_file for them
  let docContext = state.doc_context || '';
  if (!docContext) {
    const docFiles = [
      'skills/sgm-docs/SKILL.md',
    ];
    for (const df of docFiles) {
      try {
        const dfAbs = path.join(_r, df);
        if (fs.existsSync(dfAbs)) {
          docContext += '\n【' + df + '】\n' + fs.readFileSync(dfAbs, 'utf-8');
        }
      } catch { }
    }
  }

  const conversationHistory = state.conversation || [];
  const msgs = [
    { role: 'system', content: baseSystemPrompt + '\n\n---\n' + docContext },
    ...conversationHistory,
    { role: 'user', content: questionText },
  ];

  // Phase 1: Source code + docs verification (mandatory tool calls)
  let response;
  let phase = 'tool';
  let maxLoops = 8;

  // Collect referenced files across all phases for guard_node
  const collectedFiles = new Set();
  function trackFile(source, ref) {
    if (ref) collectedFiles.add(source + ':' + ref);
  }
  while (maxLoops-- > 0) {
    try {
      response = await model.invoke(msgs);
    } catch (e) {
      console.error('[respond] model.invoke error:', e.message || String(e));
      return { messages: [], answer: '申し訳ございません。回答を生成できませんでした。', turn_count: state.turn_count + 1 };
    }
    const toolCalls = response.tool_calls || [];

    if (phase === 'tool') {
      if (toolCalls.length === 0) {
        console.log('[respond] [Phase:tool] NO tool calls — model must verify via source code first. Rejected.');
        msgs.push({
          role: 'assistant',
          content: response.content || '[REJECTED] ツールを呼びませんでした。ソースコードで事実を確認してから再度回答してください。',
        });
        msgs.push(new ToolMessage({ tool_call_id: '__system__', content: 'ERROR: ツール呼び出しは必須です。API仕様・設定方法に関する質問では、必ず read_file または grep_search でソースコードを確認してください。' }));
        continue;
      }
      // Check if any tool call is NOT read_file or grep_search
      const hasNonSourceTool = toolCalls.some(tc => !['read_file', 'grep_search'].includes(tc.name));
      if (hasNonSourceTool) {
        // If model tries to use web_fetch in phase 1, reject it — must verify source code first
        console.log('[respond] [Phase:tool] web_fetch used before source code verification — rejected.');
        for (const tc of toolCalls) {
          if (!ALLOWED.includes(tc.name)) {
            msgs.push(new ToolMessage({ tool_call_id: tc.id, content: 'Tool not allowed: ' + tc.name }));
          } else if (!['read_file', 'grep_search'].includes(tc.name)) {
            msgs.push(new ToolMessage({ tool_call_id: tc.id, content: 'ERROR: web_fetch はソースコード確認後に呼び出してください。まず read_file / grep_search で SGM のソースコードを確認してください。' }));
          } else {
            const tool = tools.find(t => t.name === tc.name);
            const result = tool ? await cachedToolInvoke(tool, tc.args, tc.name) : 'Tool not available: ' + tc.name;
            msgs.push(new ToolMessage({ tool_call_id: tc.id, content: result }));
          }
        }
        continue;
      }
      // Process read_file / grep_search calls
      console.log('[respond] [Phase:tool] ' + toolCalls.length + ' source tool call(s)');
      for (const tc of toolCalls) {
        if (!ALLOWED.includes(tc.name)) {
          msgs.push(new ToolMessage({ tool_call_id: tc.id, content: 'Tool not allowed: ' + tc.name }));
          continue;
        }
        const tool = tools.find(t => t.name === tc.name);
        const result = tool ? await cachedToolInvoke(tool, tc.args, tc.name) : 'Tool not available: ' + tc.name;
        const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
        const _ref = tc.name === 'read_file' ? (tc.args?.path || tc.args?.file_path || '') : (tc.name === 'grep_search' ? (tc.args?.query || tc.args?.pattern || '') : '');
        console.log('[respond] tool ' + tc.name + (_ref ? ' [' + _ref + ']' : '') + ' result length:', resultStr.length);
        msgs.push(new ToolMessage({ tool_call_id: tc.id, content: resultStr }));
      }
      // After processing source code tools, check if external search is needed
      const externalKeywords = ['solace', 'aws', 'azure', 'gcp', 'google', 'openai', 'anthropic', 'bedrock', 'llama.cpp', 'ollama', 'kubernetes', 'docker', 'kafka', 'rabbitmq', 'redis', 'firebase', 'vercel', 'lambda', 'databricks', 'tableau', 'snowflake', 'databend', 'dolphin', 'prometheus', 'grafana', 'langchain', 'langgraph', 'crewai', 'autogen', 'camunda', 'temporal', 'stepzen', 'zapier', 'make', 'n8n', 'node-red', 'mqtt', 'amqp', 'jms', 'rest api', 'grpc', 'websocket', 'http'];
      const qLower = questionText.toLowerCase();
      const mentionsExternal = externalKeywords.some(kw => qLower.includes(kw));
      if (mentionsExternal) {
        msgs.push({ role: 'system', content: '【外部情報検索フェーズ】ソースコード・公開ドキュメントの確認が完了しました。外部製品・サービスの情報を web_fetch で検索してください。read_file/grep_search は使用できません。' });
        phase = 'external';
      } else {
        msgs.push({ role: 'system', content: '外部情報の必要はないようです。ツールで確認した事実を基に回答を生成してください。' });
        phase = 'answer';
      }
      continue;
    }

    // Phase 2: External info search — model MUST use web_fetch if source code/docs don't have the info
    if (phase === 'external') {
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      const toolCalls2 = response.tool_calls || [];
      if (toolCalls2.length > 0) {
        // Check if model used web_fetch (the only allowed tool in external phase)
        const hasWebFetch = toolCalls2.some(tc => tc.name === 'web_fetch');
        const hasSourceTool = toolCalls2.some(tc => ['read_file', 'grep_search'].includes(tc.name));
        if (hasSourceTool) {
          // Model used source code tools in external phase — reject
          console.log('[respond] [Phase:external] source tools used in external phase — rejected.');
          for (const tc of toolCalls2) {
            if (!ALLOWED.includes(tc.name)) {
              msgs.push(new ToolMessage({ tool_call_id: tc.id, content: 'Tool not allowed: ' + tc.name }));
            } else if (['read_file', 'grep_search'].includes(tc.name)) {
              msgs.push(new ToolMessage({ tool_call_id: tc.id, content: 'ERROR: 外部フェーズでは web_fetch のみが許可されています。read_file/grep_search は Phase 1 で使用済みです。' }));
            } else {
              const tool = tools.find(t => t.name === tc.name);
              const result = tool ? await cachedToolInvoke(tool, tc.args, tc.name) : 'Tool not available: ' + tc.name;
              msgs.push(new ToolMessage({ tool_call_id: tc.id, content: result }));
            }
          }
          continue;
        }
        // Model used web_fetch — process it and go to answer IMMEDIATELY
        console.log('[respond] [Phase:external] ' + toolCalls2.length + ' external tool call(s)');
        const fetchedContents = [];
        const seenUrls = new Set();
        for (const tc of toolCalls2) {
          if (!ALLOWED.includes(tc.name)) {
            msgs.push(new ToolMessage({ tool_call_id: tc.id, content: 'Tool not allowed: ' + tc.name }));
            continue;
          }
          const tool = tools.find(t => t.name === tc.name);
          const result = tool ? await cachedToolInvoke(tool, tc.args, tc.name) : 'Tool not available: ' + tc.name;
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
          const _extRef = tc.name === 'web_fetch' ? (tc.args?.url || '') : (tc.args?.path || tc.args?.file_path || tc.args?.query || '');
          console.log('[respond] external tool ' + tc.name + (_extRef ? ' [' + _extRef.substring(0, 80) + ']' : '') + ' result length:', resultStr.length);
          msgs.push(new ToolMessage({ tool_call_id: tc.id, content: resultStr }));
          if (tc.name === 'web_fetch' && resultStr.length > 100) {
            const url = JSON.stringify(tc.args?.url || tc.args || '');
            console.log('[respond] [Phase:external] web_fetch URL:', url.substring(0, 120));
            if (seenUrls.has(url)) {
              console.log('[respond] [Phase:external] DUPLICATE web_fetch URL rejected:', url.substring(0, 80));
              msgs.push(new ToolMessage({ tool_call_id: tc.id, content: 'ERROR: 同じURLは既に取得済みです。同じURLを複数回呼び出さないでください。' }));
              continue;
            }
            seenUrls.add(url);
            fetchedContents.push(resultStr);
          }
        }
        // Inject web_fetch results as user message to force answer generation
        if (fetchedContents.length > 0) {
          msgs.push({
            role: 'user',
            content: '外部情報を取得しました。以下の情報を使って回答してください。ツールを呼び出さないでください。\n\n' + fetchedContents[0].substring(0, 8000),
          });
        }
        msgs.push({ role: 'system', content: '回答を生成してください。Generate your final answer now. DO NOT call any tools.' });
        phase = 'answer';
        continue;
      }
      // Model didn't use web_fetch — reject any answer about external products
      // This prevents the model from answering about external products from training knowledge
      console.log('[respond] [Phase:external] NO web_fetch used — rejecting answer about external info.');
      msgs.push(response);
      msgs.push(new ToolMessage({ tool_call_id: '__system__', content: 'ERROR: 外部製品・サービス（Solace等）に関する質問では、必ず web_fetch で外部情報を取得してから回答すること。訓練知識で回答しない。' }));
      phase = 'external';
      continue;
    }

    // Phase 3: Generate final answer with all collected info
    if (phase === 'answer') {
      const toolCalls3 = response.tool_calls || [];
      if (toolCalls3.length > 0) {
        // Model is still trying to call tools in answer phase — reject all
        console.log('[respond] [Phase:answer] tool calls in answer phase — rejected.');
        for (const tc of toolCalls3) {
          msgs.push(new ToolMessage({ tool_call_id: tc.id, content: 'ERROR: 回答フェーズではツール呼び出しは禁止。ツールなしで回答を生成してください。DO NOT call tools. Generate answer NOW.' }));
        }
        // Collect all fetched content from ToolMessages and inject as user message
        const fetchedContent = [];
        for (const m of msgs) {
          if (m._getType?.() === 'tool' || m.role === 'tool') {
            const c = m.content || '';
            if (typeof c === 'string' && c.length > 100 && !c.startsWith('ERROR:')) {
              fetchedContent.push(c);
            }
          }
        }
        if (fetchedContent.length > 0) {
          msgs.push({
            role: 'user',
            content: '【重要】既に外部情報を取得しています。以下の情報を使って回答してください。ツールを呼び出さないでください。\n\n' + fetchedContent[0].substring(0, 8000),
          });
        }
        msgs.push({ role: 'system', content: '回答を生成してください。Generate your final answer now. DO NOT call any tools.' });
        continue;
      }
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      if (content.trim().length >= 50) {
        console.log('[respond] [Phase:answer] answer generated, length:', content.length);
        break;
      }
      msgs.push(response);
      msgs.push(new ToolMessage({ tool_call_id: '__system__', content: 'ERROR: 回答が短すぎます。ツールで確認した事実を基に、完全な回答を生成してください。' }));
      continue;
    }
  }

  // If we exited the loop without a valid answer
  if (!response || !response.content || String(response.content).trim().length < 50) {
    console.log('[respond] FINAL: could not generate valid answer after tool verification');
    return { messages: [], answer: '申し訳ございません。回答を生成できませんでした。ツールでソースコードを確認しましたが、該当情報を取得できませんでした。', turn_count: state.turn_count + 1 };
  }

  let answer = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  if (answer === 'null' || answer === 'undefined') answer = '';
  console.log('[respond] answer length:', answer.length, 'answer preview:', answer.substring(0, 100));
  if (!answer.trim()) {
    console.log('[respond] FINAL: answer is empty - model returned nothing');
    return { messages: [], answer: '申し訳ございません。回答を生成できませんでした。', turn_count: state.turn_count + 1 };
  }
  const conv = state.conversation || [];
  return { messages: [response], answer: answer, turn_count: state.turn_count + 1, conversation: [...conv, { role: 'assistant', content: answer }], doc_context: docContext };
}
