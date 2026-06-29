# Relaypoint configuration examples

These minimal examples show the shape of Relaypoint's optional local context files. Copy only the fields that matter to the project and keep paths repository-relative.

## Project profile

```json
{
  "schema_version": "0.3.0",
  "project_name": "Example Node Service",
  "description": "A local service used by the example team.",
  "critical_paths": ["src/auth/", "package.json"],
  "ignored_paths": ["fixtures/generated/"],
  "preferred_validation": ["test", "build"],
  "review_focus": ["preserve backwards-compatible API behavior"],
  "quality": {
    "max_file_lines": 400,
    "max_function_lines": 80,
    "max_line_length": 160,
    "allow_todos": false
  },
  "notes": []
}
```

Save this as `.relaypoint/project_profile.json`.

## Rules

```json
{
  "schema_version": "0.5.0",
  "rules": [
    {
      "id": "validation_failures_block_review",
      "enabled": true,
      "severity": "blocking",
      "description": "Validation failures require review.",
      "when": "validation_failed"
    },
    {
      "id": "critical_paths_require_validation",
      "enabled": true,
      "severity": "warning",
      "description": "Critical path changes should be validated.",
      "when": "critical_path_changed_without_validation"
    }
  ]
}
```

Save this as `.relaypoint/rules.json`. Rules select from Relaypoint's fixed deterministic trigger set and never execute commands.
