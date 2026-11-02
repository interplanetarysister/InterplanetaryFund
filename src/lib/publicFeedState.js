const PUBLIC_FEED_ERROR =
  "Public content is temporarily unavailable. Please try again.";

export function publicFeedState(campaignResult, postResult) {
  const campaignError =
    Boolean(campaignResult?.error) || !Array.isArray(campaignResult?.data);
  const postError =
    Boolean(postResult?.error) || !Array.isArray(postResult?.data);

  return {
    campaigns: campaignError ? [] : campaignResult.data,
    posts: postError ? [] : postResult.data,
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
