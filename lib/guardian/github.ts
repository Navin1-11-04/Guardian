import { Octokit } from "octokit";

export async function createGitHubIssue(
  owner: string,
  repo: string,
  title: string,
  body?: string,
) {
  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

    const response = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body: body || "",
    });

    return {
      id: response.data.id,
      number: response.data.number,
      title: response.data.title,
      url: response.data.html_url,
    };
  } catch (error: any) {
    throw new Error(`Failed to create GitHub issue: ${error.message}`);
  }
}

export async function listGitHubIssues(
  owner: string,
  repo: string,
  state: "open" | "closed" = "open",
  limit: number = 10,
) {
  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

    const response = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state,
      per_page: limit,
    });

    return response.data.map((issue) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      url: issue.html_url,
    }));
  } catch (error: any) {
    throw new Error(`Failed to list GitHub issues: ${error.message}`);
  }
}

export async function closeGitHubIssue(
  owner: string,
  repo: string,
  issueNumber: number,
) {
  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

    const response = await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      state: "closed",
    });

    return {
      number: response.data.number,
      state: response.data.state,
      url: response.data.html_url,
    };
  } catch (error: any) {
    throw new Error(`Failed to close GitHub issue: ${error.message}`);
  }
}
