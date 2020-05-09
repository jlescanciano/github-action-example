interface MinClause {
  count: number
}

interface WhenClause {
  fileSetContains: string
}

interface RequiredClause {
  reviewers: string[]
  teams: string[]
}

export interface Approval {
  name: string
  min: MinClause
  when: WhenClause
  required: RequiredClause
}

export interface RuleSet {
  approval: Approval[]
}
