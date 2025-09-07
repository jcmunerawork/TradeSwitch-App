import { PlanCard, PlanDetails } from '../models/account-settings';

export const MOCK_PLAN_DETAILS: PlanDetails = {
  currentPlan: 'Pro Plan',
  renewalDate: '2025-08-27',
  remainingUntilRenewal: '16 days',
  price: 250.0,
  activationFee: null,
  billingCycle: 'Monthly',
};

export const PLANS: PlanCard[] = [
  {
    name: 'Starter',
    price: 35,
    period: '/month',
    icon: 'circle',
    color: '#4b7ee8',
    features: [
      { label: 'Profit Target', value: '$6,000' },
      { label: 'Max Contracts', value: '6' },
      { label: 'Trading Accounts', value: '1' },
      { label: 'Daily Loss Limit', value: '$2,400' },
      { label: 'Activation Fee', value: 'N/A' },
      { label: 'Consistency Rule', value: 'Yes' },
    ],
    cta: 'Get Starter Now',
  },
  {
    name: 'Pro',
    price: 99,
    period: '/month',
    mostPopular: true,
    icon: 'square',
    color: '#d1ff81',
    features: [
      { label: 'Profit Target', value: '$6,000' },
      { label: 'Max Contracts', value: '6' },
      { label: 'Trading Accounts', value: '5' },
      { label: 'Daily Loss Limit', value: '$2,400' },
      { label: 'Activation Fee', value: 'N/A' },
      { label: 'Consistency Rule', value: 'Yes' },
    ],
    cta: 'Change Plan',
  },
];
