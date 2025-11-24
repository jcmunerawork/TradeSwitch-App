import { PlanCard, PlanDetails } from '../models/account-settings';

/**
 * Mock data for user plan details.
 * 
 * This object simulates the current user's plan information.
 * Currently used in AccountComponent to initialize plan data.
 * 
 * NOTE: In production, this data should be obtained from the subscription service.
 * 
 * @constant MOCK_PLAN_DETAILS
 * @type {PlanDetails}
 * @see PlanDetails
 */
export const MOCK_PLAN_DETAILS: PlanDetails = {
  currentPlan: 'Pro Plan',
  renewalDate: '2025-08-27',
  remainingUntilRenewal: '16 days',
  price: 250.0,
  activationFee: null,
  billingCycle: 'Monthly',
};

/**
 * Array of available plans for subscription.
 * 
 * This array contains the definition of all plans displayed
 * in the plan selection interface. Each plan includes:
 * - Price and period information
 * - Features and limits (trading accounts, strategies, etc.)
 * - Visual information (icons, colors)
 * - Action button text (CTA)
 * 
 * Used in:
 * - PlanSettingsComponent: As initial data before loading from service
 * 
 * NOTE: In production, this data should be obtained from PlanService.
 * 
 * @constant PLANS
 * @type {PlanCard[]}
 * @see PlanCard
 */
export const PLANS: PlanCard[] = [
  {
    name: 'Free',
    price: 0,
    period: '/month',
    icon: 'circle',
    color: '#4b7ee8',
    features: [
      { label: 'Trading Accounts', value: '1' },
      { label: 'Consistency Rules', value: 'YES' },
      { label: 'Trading Journal', value: 'YES' },
      { label: 'Live Statistics', value: 'YES' },
    ],
    cta: 'Change Plan',
  },
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
    cta: 'Change Plan',
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
    cta: 'Get Starter Now',
  },
];
