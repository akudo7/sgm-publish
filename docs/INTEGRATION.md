# Integration

## kudosflow2 VSCode Extension

SceneGraphManager powers the **kudosflow2** VSCode extension, providing a visual workflow designer with a ReactFlow-based interface.

<p align="center">
  <img src="https://github.com/akudo7/kudosflow/raw/HEAD/kudosflow.png" width="600"/>
</p>

[Learn more about kudosflow2 →](https://github.com/akudo7/kudosflow)

---

## OpenAgentJSON Compatibility

SceneGraphManager v2.x fully compiles OpenAgentJSON files at runtime. See [docs/OPENAGENTJSON.md](OPENAGENTJSON.md) for the complete format specification.

```typescript
import { WorkflowEngine } from 'scenegraphmanager';
import Workflow from './your-workflow.json';

const engine = new WorkflowEngine(Workflow);
await engine.build();
```

Workflows designed in the kudosflow2 VSCode extension can be deployed to any execution environment without modification.
