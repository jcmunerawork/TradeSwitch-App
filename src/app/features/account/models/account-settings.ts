export interface PlanDetails {
  currentPlan: string;
  renewalDate: string;
  remainingUntilRenewal: string;
  price: number;
  activationFee: string | null;
  billingCycle: string;
}

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
