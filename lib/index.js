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
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const yaml = __importStar(require("js-yaml"));
const approval_predicate_1 = require("./action/approval_predicate");
const SUPPORTED_EVENTS = ['pull_request', 'pull_request_review'];
function runAction() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('Action initialized ...');
            const currentEventName = github.context.eventName;
            if (SUPPORTED_EVENTS.includes(currentEventName)) {
                console.log('Loading Octokit ...\n');
                const repositoryToken = core.getInput('token');
                const octokit = new github.GitHub(repositoryToken);
                console.log('Loading rules ...\n');
                const rulesParam = core.getInput('rules');
                const ruleset = yaml.safeLoad(rulesParam);
                const evaluationResults = yield Promise.all(ruleset.approval
                    .map(ruleSettings => new approval_predicate_1.ApprovalPredicate(ruleSettings, octokit))
                    .map((rule) => __awaiter(this, void 0, void 0, function* () { return yield rule.evaluate(github.context); })));
                evaluationResults.forEach(evaluation => console.log(`\n---\n${evaluation.log}\n---\n`));
                const success = evaluationResults.reduce((acc, item) => acc && item.result, true);
                if (success) {
                    console.log(`Success!`);
                    core.setOutput('evaluated-rules', evaluationResults.length);
                }
                else {
                    const failedRules = evaluationResults
                        .filter(result => !result.result)
                        .map(result => result.name);
                    core.setFailed(`The following evaluation rules weren't satisfied: ${JSON.stringify(failedRules, null, 2)}`);
                }
            }
            else {
                console.log(`Unsupported event ${currentEventName}`);
            }
        }
        catch (error) {
            console.log(error.stack);
            core.setFailed(error.message);
        }
    });
}
runAction();
