import { useState, useEffect } from 'react';

export function useFeatureAccess(feature: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);
  const [isDesignLimitReached, setIsDesignLimitReached] = useState(false);
  const [isNotLoggedIn, setIsNotLoggedIn] = useState(false);
  const [designsCreated, setDesignsCreated] = useState(0);
  const [designLimit, setDesignLimit] = useState(10);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setIsLoading(false);
    }, 100);
  }, []);

  return {
    hasAccess,
    isLoading,
    isDesignLimitReached,
    isNotLoggedIn,
    designsCreated,
    designLimit,
  };
}
