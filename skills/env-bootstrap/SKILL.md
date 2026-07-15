---
name: env-bootstrap
description: Language-specific project detection for environment bootstrapping — provides test file patterns, build commands, and config file names for C++, Rust, Go, Java, Python, and JavaScript/TypeScript projects
---

# Environment Bootstrap Skill

Detect the target project's programming language and provide language-specific
information for bootstrap nodes (bootstrap_generator_node, bootstrap_evaluator_node).

## When to Use

Use this skill when the bootstrap nodes have detected project context but
language-specific details are needed — e.g. when listing test files, running
build commands, or reading config files for a specific language.

## IMPORTANT CONSTRAINTS

- **MUST** use the language-specific sections below — do NOT hardcode patterns
  into JSON workflow files.
- **MUST** detect the language from existing files (CMakeLists.txt, Cargo.toml,
  go.mod, pom.xml, etc.) before applying detection rules.
- **DO NOT** modify the JSON workflow configuration files directly.

---

## Language Detection

Check for the presence of config files to determine the project language:

| Language | Config File(s) |
|----------|---------------|
| C/C++ | `CMakeLists.txt`, `Makefile`, `*.cmake` |
| Rust | `Cargo.toml` |
| Go | `go.mod` |
| Java | `pom.xml`, `build.gradle` |
| Python | `requirements.txt`, `pyproject.toml` |
| JavaScript/TypeScript | `package.json` |

---

## C / C++

### Test File Patterns

```
*test.cpp
*test.cc
*test.c
*_test.cpp
*_test.cc
*_test.c
*Test.cpp
*Test.cc
*Test.c
tests/*_test.*
tests/*Test.*
```

### Build Commands

```bash
cmake --build build --target all 2>&1 | tail -30
cmake --build build 2>&1 | tail -30
make 2>&1 | tail -30
ninja 2>&1 | tail -30
```

### Config Files

- `CMakeLists.txt` — CMake build configuration
- `Makefile` — Make build targets
- `.clang-format` — Code formatting rules
- `vcpkg.json` — vcpkg dependencies
- `package.json` — Node.js-based build tools (clangd, etc.)

---

## Rust

### Test File Patterns

```
*test.rs
*_test.rs
tests/*.rs
```

### Build Commands

```bash
cargo build 2>&1 | tail -30
cargo test --no-run 2>&1 | tail -30
cargo check 2>&1 | tail -30
```

### Config Files

- `Cargo.toml` — Package manifest and dependencies
- `Cargo.lock` — Dependency lockfile
- `clippy.toml` — Clippy linter config

---

## Go

### Test File Patterns

```
*_test.go
```

### Build Commands

```bash
go build ./... 2>&1 | tail -30
go test -c ./... 2>&1 | tail -30
go vet ./... 2>&1 | tail -30
```

### Config Files

- `go.mod` — Module definition
- `go.sum` — Dependency checksums
- `.golangci.yml` — GolangCI linter config

---

## Java

### Test File Patterns

```
src/test/**/*Test.java
src/test/**/*Tests.java
src/test/**/*Spec.java
*Test.java
*Tests.java
*Spec.java
```

### Build Commands

```bash
mvn test -q 2>&1 | tail -30
gradle test 2>&1 | tail -30
./gradlew test 2>&1 | tail -30
```

### Config Files

- `pom.xml` — Maven configuration
- `build.gradle` / `build.gradle.kts` — Gradle configuration
- `settings.gradle` — Gradle settings

---

## Python

### Test File Patterns

```
test_*.py
*_test.py
*test*.py
tests/*.py
```

### Build Commands

```bash
python -m pytest 2>&1 | tail -30
python -m unittest discover 2>&1 | tail -30
python setup.py test 2>&1 | tail -30
pip install -e . 2>&1 | tail -30
```

### Config Files

- `pyproject.toml` — PEP 621 package config
- `setup.py` / `setup.cfg` — Legacy setup
- `requirements.txt` — Dependencies
- `poetry.lock` — Poetry lockfile

---

## JavaScript / TypeScript

### Test File Patterns

```
*.test.js
*.test.ts
*.test.jsx
*.test.tsx
*.spec.js
*.spec.ts
*.spec.jsx
*.spec.tsx
__tests__/*.test.*
__tests__/*.spec.*
```

### Build Commands

```bash
npm run build 2>&1 | tail -30
yarn build 2>&1 | tail -30
pnpm build 2>&1 | tail -30
npx tsc --noEmit 2>&1 | tail -30
```

### Config Files

- `package.json` — Scripts, dependencies, devDependencies
- `tsconfig.json` — TypeScript configuration
- `.eslintrc*` — ESLint rules

---

## Usage Example

When a bootstrap node needs language-specific information:

1. **Detect language** — check for config files (CMakeLists.txt → C++, Cargo.toml → Rust, etc.)
2. **Apply relevant section** — use the matching language block above
3. **Inject into activeMessages** — format as `=== {Language} Bootstrap ===` prefix
4. **Follow reducer rules** — bootstrap messages replace the full array via the
   activeMessages reducer (detects `=== {Language} Bootstrap ===` prefix)
