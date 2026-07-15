# Examples

## Conditional Routing

```typescript
const config = {
  // ... base config
  nodes: [
    { id: "classifier", type: "model", modelRef: "claude" },
    { id: "handler_a", type: "model", modelRef: "claude" },
    { id: "handler_b", type: "model", modelRef: "claude" }
  ],
  edges: [
    { from: "__start__", to: "classifier" },
    {
      from: "classifier",
      type: "conditional",
      condition: "(state) => state.category === 'A' ? 'handler_a' : 'handler_b'"
    },
    { from: "handler_a", to: "__end__" },
    { from: "handler_b", to: "__end__" }
  ]
};
```

## Multi-Agent Workflow

```typescript
const config = {
  // ... base config
  a2aClients: {
    researcher: { cardUrl: "https://agent1.example.com/.well-known/agent.json" },
    writer: { cardUrl: "https://agent2.example.com/.well-known/agent.json" }
  },
  nodes: [
    { id: "research", type: "model", modelRef: "claude", useA2AClients: ["researcher"] },
    { id: "write", type: "model", modelRef: "claude", useA2AClients: ["writer"] }
  ],
  edges: [
    { from: "__start__", to: "research" },
    { from: "research", to: "write" },
    { from: "write", to: "__end__" }
  ]
};
```

## Custom State with Reducers

```typescript
const config = {
  // ... base config
  annotation: {
    messages: {
      type: "BaseMessage[]",
      reducer: "(x, y) => x.concat(y)",
      default: "[]"
    },
    context: {
      type: "Record<string, any>",
      reducer: "(x, y) => ({ ...x, ...y })",
      default: "{}"
    },
    counter: {
      type: "number",
      reducer: "(x, y) => x + y",
      default: "0"
    }
  }
};
```

## PII Filtering

Configure PiiFilter inside the Ollama model definition. Filtering is applied automatically on every `invoke()` call before the message reaches the AI model.

```json
{
  "models": [
    {
      "id": "ollamaModel",
      "type": "ollama",
      "config": {
        "model": "llama3.2",
        "baseUrl": "http://localhost:11434",
        "piiFilter": {
          "enabled": true,
          "rules": [
            { "type": "email",       "strategy": "redact" },
            { "type": "ip",          "strategy": "mask"   },
            { "type": "credit_card", "strategy": "block"  },
            { "type": "phone_number","strategy": "redact" },
            {
              "type": "employee_id",
              "strategy": "redact",
              "pattern": "EMP-\\d{6}"
            }
          ]
        }
      }
    }
  ]
}
```

| Strategy | Behaviour |
|---|---|
| `redact` | Replace with `[REDACTED_<TYPE>]` |
| `mask` | Partially hide (e.g. IP → `10.20.x.x`, email → `u***@domain.com`) |
| `hash` | Pseudonymize with a stable hash code |
| `block` | Throw `PiiBlockedError` — stops the workflow |

Custom patterns use the `pattern` field (JavaScript regex string). The full working example is in [`json/pii.json`](json/pii.json).
