"use strict";
// interface Person {
//     firstName: string
//     lastName: string
// }
//
// class Student {
//     fullName: string;
//     constructor(public firstName: string, public middleInitial: string, public lastName: string) {
//         this.fullName = firstName + " " + middleInitial + " " + lastName;
//     }
// }
//
// function greeter(person: Person) {
//     return `Hello, ${person.firstName} ${person.lastName}`;
// }
//
// let user = new Student("john", "mc", "doe");
//
// console.log(greeter(user));
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var core = require('@actions/core');
var github = require('@actions/github');
var fs = require('fs');
var yaml = require("js-yaml");
var _ = require('lodash');
var path = require('path');
var supported_events = ["pull_request", "pull_request_review"];
function prChangedFiles(ctx, octokit) {
    return __awaiter(this, void 0, void 0, function () {
        var changedFiles;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, octokit.paginate(octokit.pulls.listFiles.endpoint.merge({ owner: ctx.repo.owner, repo: ctx.repo.repo, pull_number: ctx.payload.number }), function (res) { return res.data; })];
                case 1:
                    changedFiles = _a.sent();
                    return [2 /*return*/, changedFiles.map(function (file) { return file.filename; })];
            }
        });
    });
}
function teamMembers(ctx, octokit, team) {
    return __awaiter(this, void 0, void 0, function () {
        var members, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    members = [{ login: "@" + team.org + "/" + team.slug }];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, octokit.paginate(octokit.teams.listMembersInOrg.endpoint.merge({ org: team.org, team_slug: team.slug }), function (res) { return res.data; })];
                case 2:
                    members = _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error("Error requesting team members for " + team.org + "/" + team.slug);
                    console.log(error_1.stack);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/, members.map(function (member) { return member.login; })];
            }
        });
    });
}
var findReviewersByState = function (reviews, state) {
    // filter out review submitted comments because it does not nullify an approved state.
    // Other possible states are PENDING and REQUEST_CHANGES. At those states the user has not approved the PR.
    // See https://developer.github.com/v3/pulls/reviews/#list-reviews-on-a-pull-request
    // While submitting a review requires the states be PENDING, REQUEST_CHANGES, COMMENT and APPROVE
    // The payload actually returns the state in past tense: i.e. APPROVED, COMMENTED
    var relevantReviews = reviews.filter(function (element) { return element.state.toLowerCase() !== 'commented'; });
    // order it by date of submission. The docs says the order is chronological but we sort it so that
    // uniqBy will extract the correct last submitted state for the user.
    var ordered = _.orderBy(relevantReviews, ['submitted_at'], ['desc']);
    var uniqueByUser = _.uniqBy(ordered, 'user.login');
    // approved reviewers are ones that are approved and not nullified by other submissions later.
    return uniqueByUser
        .filter(function (element) { return element.state.toLowerCase() === state; })
        .map(function (review) { return review.user && review.user.login; });
};
function prApprovedReviewers(ctx, octokit) {
    return __awaiter(this, void 0, void 0, function () {
        var reviews;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, octokit.paginate(octokit.pulls.listReviews.endpoint.merge({ repo: ctx.repo.repo, owner: ctx.repo.owner, pull_number: ctx.payload.number }), function (res) { return res.data; })];
                case 1:
                    reviews = _a.sent();
                    return [2 /*return*/, findReviewersByState(reviews, 'approved')];
            }
        });
    });
}
var ApprovalPredicate = /** @class */ (function () {
    function ApprovalPredicate(rawSettings, octokit) {
        this.settings = rawSettings;
        this.octokit = octokit;
    }
    ApprovalPredicate.prototype.evaluate = function (githubContext) {
        return __awaiter(this, void 0, void 0, function () {
            var evaluationLog, ruleName, whenClause, doEvaluation, fileRegExp_1, filesChanged, fileMatches, evaluationResult, minApprovals, requiredReviewers, extractGitHubTeam, requiredTeams, requiredTeamsAndMembers, requiredTeamMembers, fullReviewersList_1, currentApprovedReviewers, requiredReviewersApproving;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        evaluationLog = "";
                        ruleName = this.settings.name;
                        evaluationLog = evaluationLog.concat("Evaluating " + ruleName + "\n");
                        whenClause = this.settings.when;
                        doEvaluation = true;
                        if (!(whenClause && whenClause.fileSetContains)) return [3 /*break*/, 2];
                        fileRegExp_1 = new RegExp(whenClause.fileSetContains, 'i');
                        return [4 /*yield*/, prChangedFiles(githubContext, this.octokit)];
                    case 1:
                        filesChanged = _a.sent();
                        fileMatches = filesChanged.reduce(function (acc, file) { return acc || fileRegExp_1.test(file); }, false);
                        if (!fileMatches)
                            doEvaluation = false;
                        _a.label = 2;
                    case 2:
                        evaluationResult = true;
                        if (!doEvaluation) return [3 /*break*/, 5];
                        minApprovals = this.settings.min.count;
                        requiredReviewers = (this.settings.required && this.settings.required.reviewers) ? this.settings.required.reviewers : [];
                        extractGitHubTeam = function (text) {
                            var parts = text.split("/", 2);
                            return { org: parts[0], slug: parts[1] };
                        };
                        requiredTeams = (this.settings.required && this.settings.required.teams) ? this.settings.required.teams.map(extractGitHubTeam) : [];
                        return [4 /*yield*/, Promise.all(requiredTeams.map(function (team) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, teamMembers(githubContext, this.octokit, team)];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            }); }); }))];
                    case 3:
                        requiredTeamsAndMembers = _a.sent();
                        requiredTeamMembers = requiredTeamsAndMembers.reduce(function (acc, members) { return acc.concat(members); }, []);
                        fullReviewersList_1 = _.uniq(requiredReviewers.concat(requiredTeamMembers));
                        evaluationLog = evaluationLog.concat("Required reviewers list: " + JSON.stringify(fullReviewersList_1, null, 2) + "\n");
                        return [4 /*yield*/, prApprovedReviewers(githubContext, this.octokit)];
                    case 4:
                        currentApprovedReviewers = _a.sent();
                        evaluationLog = evaluationLog.concat("Current reviewers who approved the PR: " + JSON.stringify(currentApprovedReviewers, null, 2) + "\n");
                        requiredReviewersApproving = currentApprovedReviewers.filter(function (reviewer) { return fullReviewersList_1.includes(reviewer); });
                        evaluationLog = evaluationLog.concat("Required reviewers who approved the PR: " + JSON.stringify(requiredReviewersApproving, null, 2) + "\n");
                        evaluationResult = requiredReviewersApproving.length >= minApprovals;
                        evaluationLog = evaluationLog.concat("Got (" + requiredReviewersApproving.length + ") required reviewers approving of (" + minApprovals + ") needed\n");
                        evaluationLog = evaluationLog.concat("Evaluation result: " + evaluationResult);
                        _a.label = 5;
                    case 5:
                        console.log("\n---\n" + evaluationLog + "\n---\n");
                        return [2 /*return*/, { name: ruleName, skipped: !doEvaluation, result: evaluationResult }];
                }
            });
        });
    };
    return ApprovalPredicate;
}());
function runAction() {
    return __awaiter(this, void 0, void 0, function () {
        var currentEventName, repositoryToken, octokit_1, rulesParam, ruleset, evaluationResults, success, failedRules, error_2;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    console.log('Action initialized ...');
                    currentEventName = github.context.eventName;
                    if (!supported_events.includes(currentEventName)) return [3 /*break*/, 2];
                    console.log('Loading Octokit ...\n');
                    repositoryToken = core.getInput('token');
                    octokit_1 = new github.GitHub(repositoryToken);
                    console.log('Loading rules ...\n');
                    rulesParam = core.getInput('rules');
                    ruleset = yaml.safeLoad(rulesParam);
                    return [4 /*yield*/, Promise.all(ruleset.approval
                            .map(function (ruleSettings) { return new ApprovalPredicate(ruleSettings, octokit_1); })
                            .map(function (rule) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, rule.evaluate(github.context)];
                                case 1: return [2 /*return*/, _a.sent()];
                            }
                        }); }); }))];
                case 1:
                    evaluationResults = _a.sent();
                    success = evaluationResults.reduce(function (acc, item) { return acc && item.result; }, true);
                    if (success) {
                        console.log("Success!");
                        core.setOutput("evaluated-rules", evaluationResults.length);
                    }
                    else {
                        failedRules = evaluationResults.filter(function (result) { return !result.result; }).map(function (result) { return result.name; });
                        core.setFailed("The following evaluation rules weren't satisfied: " + JSON.stringify(failedRules, null, 2));
                    }
                    return [3 /*break*/, 3];
                case 2:
                    console.log("Unsupported event " + currentEventName);
                    _a.label = 3;
                case 3: return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    console.log(error_2.stack);
                    core.setFailed(error_2.message);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
runAction();
