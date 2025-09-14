import { useEffect, useMemo } from 'react';
import { logger } from '../../shared/utils/logger';
import { useOptionalAuth } from '../../components/auth';

type Mode = 'local' | 'cloud' | 'markdown';

export function useCloudAuthGate(
  storageMode: Mode,
  setShowLoginModal: (v: boolean) => void,
  onAuthenticated?: () => void
) {
  const auth = useOptionalAuth();

  const isCloudMode = storageMode === 'cloud';
  const needsAuth = isCloudMode && !!auth && !auth.authState.isAuthenticated;

  useEffect(() => {
    if (!isCloudMode || !auth) return;
    logger.debug('Auth check:', {
      isCloudMode,
      hasAuth: !!auth,
      authIsReady: auth?.isReady,
      isAuthenticated: auth?.authState.isAuthenticated,
      needsAuth,
    });

    if (needsAuth && auth.isReady) {
      logger.info('Showing login modal');
      setShowLoginModal(true);
    } else if (auth.authState.isAuthenticated) {
      logger.info('User authenticated, hiding login modal');
      setShowLoginModal(false);
    }
  }, [auth, isCloudMode, needsAuth, setShowLoginModal]);

  useEffect(() => {
    if (isCloudMode && auth?.authState.isAuthenticated && auth?.isReady) {
      logger.info('🔄 Authentication successful in cloud mode, forcing data reload');
      onAuthenticated?.();
    }
  }, [isCloudMode, auth?.authState.isAuthenticated, auth?.isReady, onAuthenticated]);

  return useMemo(() => ({ auth, isCloudMode, needsAuth }), [auth, isCloudMode, needsAuth]);
}
