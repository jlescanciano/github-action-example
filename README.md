# Approval Check Github Action

This action checks for approvals on PRs

## Inputs

### `token`

Token to use for the Github integration. Default `${{ github.token }}`.

### `rules`

Rules to check on PRs

```yaml
approval:
  - name: "Required approvals for whatever"
    min:
      count: 1
    when:
      fileSetContains: "^."
    required:
      reviewers: ["reviewer1"]
      teams: ["org/team1"]
  - name: "Required approvals for something else"
      min:
        count: 3
      when:
        fileSetContains: "^."
      required:
        reviewers: ["reviewer2"]
        teams: ["org/team2"]
```

## Outputs

### `evaluated-rules`

Number of evaluated (not skipped) rules.

## Example usage

```yaml
uses: jlescanciano/github-action-example@v1.1
with:
  rules: >
    approval:
      - name: "Required approvals for whatever"
        min:
          count: 2
        when:
          fileSetContains: "^."
        required:
          reviewers: ["reviewer1"]
          teams: ["org/team"]
```
