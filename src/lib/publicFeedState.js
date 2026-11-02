const PUBLIC_FEED_ERROR = "Public content is temporarily unavailable. Please try again.";

export function publicFeedState(campaignResult, postResult) {
  const campaignError = Boolean(campaignResult?.error);
  const postError = Boolean(postResult?.error);
  return {
    campaigns: campaignError || !Array.isArray(campaignResult?.data) ? [] : campaignResult.data,
    posts: postError || !Array.isArray(postResult?.data) ? [] : postResult.data,
    campaignError,
    postError,
    message: campaignError || postError ? PUBLIC_FEED_ERROR : "",
  };
}

export function publicFeedFailure() {
  return {
    campaigns: [],
    posts: [],
    campaignError: true,
    postError: true,
    message: PUBLIC_FEED_ERROR,
  };
}
