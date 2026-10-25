import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { reportFrontendError } from '@/lib/platformErrorReporter';


export const queryClientInstance = new QueryClient({
  queryCache: new QueryCache({onError: error=>reportFrontendError({source:'app_request',kind:'request',error,summary:'A shared data request failed'})}),
  mutationCache: new MutationCache({onError: error=>reportFrontendError({source:'app_request',kind:'request',error,summary:'An application action failed'})}),
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});