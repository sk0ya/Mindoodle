import { useEffect } from 'react';
import { useStableCallback } from '@shared/hooks';
import { EditingStateService, type EditingActivity } from '../services/EditingStateService';
import { logger } from '@shared/utils';


export const useEditingState = () => {
  const editingStateService = EditingStateService.getInstance();

  
  useEffect(() => {
    return () => {
      editingStateService.endAllActivities();
    };
  }, [editingStateService]);

  
  const startActivity = useStableCallback((activity: EditingActivity) => {
    editingStateService.startActivity(activity);
  });

  const endActivity = useStableCallback((activity: EditingActivity) => {
    editingStateService.endActivity(activity);
  });

  const isEditing = useStableCallback(() => {
    return editingStateService.isEditing();
  });

  return {
    startActivity,
    endActivity,
    isEditing
  };
};


export const useActivityLifecycle = (activity: EditingActivity, isActive: boolean) => {
  const { startActivity, endActivity } = useEditingState();

  useEffect(() => {
    if (isActive) {
      startActivity(activity);
      logger.debug(`useActivityLifecycle: Started ${activity}`);
    } else {
      endActivity(activity);
      logger.debug(`useActivityLifecycle: Ended ${activity}`);
    }

    
    return () => {
      endActivity(activity);
    };
  }, [isActive, activity, startActivity, endActivity]);
};

