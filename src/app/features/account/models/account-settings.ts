/**
 * Interface that represents the details of the user's current plan.
 * 
 * This interface contains all information related to the user's active
 * subscription plan, including billing and renewal information.
 * 
 * Used in:
 * - AccountComponent: To pass plan data to child component
 * - PlanSettingsComponent: To display current plan information
 * 
 * @interface PlanDetails
 */
export interface PlanDetails {
  currentPlan: string;
  renewalDate: string;
  remainingUntilRenewal: string;
  price: number;
  activationFee: string | null;
  billingCycle: string;
}

/**
 * Interface that represents a plan card in the user interface.
 * 
 * This interface defines the data structure needed to display a plan
 * in the plan comparison and selection interface. Includes visual
 * information (icons, colors) and functional information (price, features, CTA).
 * 
 * Used in:
 * - PlanSettingsComponent: To build and display available plan cards
 * - account-mocks.ts: To define mock data for plans
 * 
 * @interface PlanCard
 */
export interface PlanCard {
  name: string;
  price: number;
  period: string;
  mostPopular?: boolean;
  icon: string;
  color: string;
  features: {
    label: string;
    value: string;
  }[];
  cta: string;
}
