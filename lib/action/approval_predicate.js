"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = __importStar(require("lodash"));
const OctokitHelper = __importStar(require("../github/octohelper"));
class ApprovalPredicate {
    constructor(approvalDef, octokit) {
        this.approvalDef = approvalDef;
        this.octokit = octokit;
    }
    evaluate(githubContext) {
        return __awaiter(this, void 0, void 0, function* () {
            let evaluationLog = "";
            const ruleName = this.approvalDef.name;
            evaluationLog = evaluationLog.concat(`Evaluating ${ruleName}\n`);
            const whenClause = this.approvalDef.when;
            let doEvaluation = true;
            if (whenClause && whenClause.fileSetContains) {
                const fileRegExp = new RegExp(whenClause.fileSetContains, "i");
                const filesChanged = yield OctokitHelper.prChangedFiles(githubContext, this.octokit);
                const fileMatches = filesChanged.reduce((acc, file) => acc || fileRegExp.test(file), false);
                if (!fileMatches)
                    doEvaluation = false;
            }
            let evaluationResult = true;
            if (doEvaluation) {
                const minApprovals = this.approvalDef.min.count;
                const requiredReviewers = this.approvalDef.required && this.approvalDef.required.reviewers
                    ? this.approvalDef.required.reviewers
                    : [];
                const extractGitHubTeam = (text) => {
                    const parts = text.split("/", 2);
                    return { org: parts[0], slug: parts[1] };
                };
                const requiredTeams = this.approvalDef.required && this.approvalDef.required.teams
                    ? this.approvalDef.required.teams.map(extractGitHubTeam)
                    : [];
                const requiredTeamsAndMembers = yield Promise.all(requiredTeams.map((team) => __awaiter(this, void 0, void 0, function* () { return yield OctokitHelper.teamMembers(githubContext, this.octokit, team); })));
                const requiredTeamMembers = requiredTeamsAndMembers.reduce((acc, members) => acc.concat(members), []);
                const fullReviewersList = _.uniq(requiredReviewers.concat(requiredTeamMembers));
                evaluationLog = evaluationLog.concat(`Required reviewers list: ${JSON.stringify(fullReviewersList, null, 2)}\n`);
                const currentApprovedReviewers = yield OctokitHelper.prApprovedReviewers(githubContext, this.octokit);
                evaluationLog = evaluationLog.concat(`Current reviewers who approved the PR: ${JSON.stringify(currentApprovedReviewers, null, 2)}\n`);
                const requiredReviewersApproving = currentApprovedReviewers.filter(reviewer => fullReviewersList.includes(reviewer));
                evaluationLog = evaluationLog.concat(`Required reviewers who approved the PR: ${JSON.stringify(requiredReviewersApproving, null, 2)}\n`);
                evaluationResult = requiredReviewersApproving.length >= minApprovals;
                evaluationLog = evaluationLog.concat(`Got (${requiredReviewersApproving.length}) required reviewers approving of (${minApprovals}) needed\n`);
                evaluationLog = evaluationLog.concat(`Evaluation result: ${evaluationResult}`);
            }
            return {
                name: ruleName,
                skipped: !doEvaluation,
                result: evaluationResult,
                log: evaluationLog
            };
        });
    }
}
exports.ApprovalPredicate = ApprovalPredicate;
