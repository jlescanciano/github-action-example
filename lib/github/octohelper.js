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
function prChangedFiles(ctx, octokit) {
    return __awaiter(this, void 0, void 0, function* () {
        return octokit
            .paginate(octokit.pulls.listFiles.endpoint.merge({
            owner: ctx.repo.owner,
            repo: ctx.repo.repo,
            pull_number: ctx.payload.number
        }))
            .then((data) => __awaiter(this, void 0, void 0, function* () { return Promise.all(data.map((file) => __awaiter(this, void 0, void 0, function* () { return file.filename; }))); }));
    });
}
exports.prChangedFiles = prChangedFiles;
function teamMembers(ctx, octokit, team) {
    return __awaiter(this, void 0, void 0, function* () {
        // Default members is team itself prepended with @ so such member can't exist
        let members = [{ login: `@${team.org}/${team.slug}` }];
        try {
            members = yield octokit
                .paginate(octokit.teams.listMembersInOrg.endpoint.merge({
                org: team.org,
                team_slug: team.slug
            }))
                .then(data => data);
        }
        catch (error) {
            console.error(`Error requesting team members for ${team.org}/${team.slug}`);
            console.log(error.stack);
        }
        return members.map(member => member.login);
    });
}
exports.teamMembers = teamMembers;
const findReviewersByState = (reviews, state) => {
    // filter out review submitted comments because it does not nullify an approved state.
    // Other possible states are PENDING and REQUEST_CHANGES. At those states the user has not approved the PR.
    // See https://developer.github.com/v3/pulls/reviews/#list-reviews-on-a-pull-request
    // While submitting a review requires the states be PENDING, REQUEST_CHANGES, COMMENT and APPROVE
    // The payload actually returns the state in past tense: i.e. APPROVED, COMMENTED
    const relevantReviews = reviews.filter(element => element.state.toLowerCase() !== "commented");
    // order it by date of submission. The docs says the order is chronological but we sort it so that
    // uniqBy will extract the correct last submitted state for the user.
    const ordered = _.orderBy(relevantReviews, ["submitted_at"], ["desc"]);
    const uniqueByUser = _.uniqBy(ordered, "user.login");
    // approved reviewers are ones that are approved and not nullified by other submissions later.
    return uniqueByUser
        .filter(element => element.state.toLowerCase() === state)
        .map(review => review.user && review.user.login);
};
function prApprovedReviewers(ctx, octokit) {
    return __awaiter(this, void 0, void 0, function* () {
        return octokit
            .paginate(octokit.pulls.listReviews.endpoint.merge({
            repo: ctx.repo.repo,
            owner: ctx.repo.owner,
            pull_number: ctx.payload.number
        }))
            .then(data => findReviewersByState(data, "approved"));
    });
}
exports.prApprovedReviewers = prApprovedReviewers;
