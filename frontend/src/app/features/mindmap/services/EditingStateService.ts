
export type EditingActivity = 
  | 'typing' 
  | 'node-editing' 
  | 'dragging' 
  | 'menu-open'
  | 'modal-open';


export class EditingStateService {
  private static instance: EditingStateService | null = null;
  private activeActivities: Set<EditingActivity> = new Set();
  private lastActivityTime: number = 0;
  private readonly ACTIVITY_TIMEOUT = 10000; 

  private constructor() {}

  static getInstance(): EditingStateService {
    if (!EditingStateService.instance) {
      EditingStateService.instance = new EditingStateService();
    }
    return EditingStateService.instance;
  }

  
  startActivity(activity: EditingActivity): void {
    this.activeActivities.add(activity);
    this.lastActivityTime = Date.now();
  }

  
  endActivity(activity: EditingActivity): void {
    this.activeActivities.delete(activity);
    this.lastActivityTime = Date.now();
  }

  
  endAllActivities(): void {
    this.activeActivities.clear();
    this.lastActivityTime = Date.now();
  }


  
  isEditing(): boolean {
    
    this.cleanupExpiredActivities();
    
    return this.activeActivities.size > 0;
  }

  
  getActiveActivities(): EditingActivity[] {
    this.cleanupExpiredActivities();
    return Array.from(this.activeActivities);
  }

  
  getTimeSinceLastActivity(): number {
    return Date.now() - this.lastActivityTime;
  }

  
  private cleanupExpiredActivities(): void {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivityTime;
    
    if (timeSinceLastActivity > this.ACTIVITY_TIMEOUT && this.activeActivities.size > 0) {
      this.activeActivities.clear();
    }
  }

  
  getDebugInfo() {
    return {
      isEditing: this.isEditing(),
      activeActivities: Array.from(this.activeActivities),
      timeSinceLastActivity: this.getTimeSinceLastActivity(),
      activityTimeout: this.ACTIVITY_TIMEOUT
    };
  }

  
  cleanup(): void {
    this.activeActivities.clear();
    this.lastActivityTime = 0;
  }
}