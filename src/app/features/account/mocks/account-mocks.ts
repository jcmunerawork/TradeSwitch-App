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
      { label: 'Trading Accounts', value: '2' },
      { label: 'Consistency Rules', value: 'YES' },
      { label: 'Trading Journal', value: 'YES' },
      { label: 'Live Statistics', value: 'YES' },
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
      { label: 'Trading Accounts', value: '6' },
      { label: 'Consistency Rules', value: 'YES' },
      { label: 'Trading Journal', value: 'YES' },
      { label: 'Live Statistics', value: 'YES' },
    ],
    cta: 'Change Plan',
  },
];
