# TradeSwitch-App Project Documentation

## Table of Contents

1. [Account Module](#account-module)
2. [Add Account Module](#add-account-module)
3. [Overview Module](#overview-module)
4. [Report Module](#report-module)
5. [Revenue Module](#revenue-module)
6. [Trading Accounts Module](#trading-accounts-module)
7. [Strategy Module](#strategy-module)
8. [Users Details Module](#users-details-module)
9. [Guards](#guards)
10. [App Context Service](#app-context-service)
11. [Store (NgRx)](#store-ngrx)
12. [Firebase Configuration](#firebase-configuration)

---

## Account Module

The `account` module manages user account settings, including profile editing, subscription plan management, and subscription history viewing.

**Purpose**: Provides a centralized interface for users to manage their account settings, subscription plans, and view their subscription history.

**Key Features**:
- Profile information editing (name, email, phone, birthday)
- Password change with reauthentication
- Account deletion
- Subscription plan management (upgrade/downgrade)
- Plan cancellation
- Subscription history viewing

**Main Connections**:
- **AppContextService**: Gets current user data and global plans
- **AuthService**: Updates user profile and handles authentication
- **SubscriptionService**: Manages user subscriptions
- **PlanService**: Provides available plan information
- **AccountDeletionService**: Handles complete account deletion
- **Stripe API**: Payment processing and subscription management
- **Store (NgRx)**: User state management

---

## Add Account Module

The `add-account` module provides a form interface for users to register new trading accounts with their brokers.

**Purpose**: Enables users to add new trading accounts by collecting account credentials and broker information, then saving them to Firebase.

**Key Features**:
- Form collection for trading account details
- Account validation
- Unique ID generation
- Navigation to trading accounts page after creation

**Main Connections**:
- **AuthService**: Persists account data to Firebase
- **Store (NgRx)**: Gets current user information
- **Router**: Navigation after account creation

---

## Overview Module

The `overview` module provides a comprehensive administrative dashboard for viewing and analyzing user data, revenue statistics, and subscription information.

**Purpose**: Serves as the main analytics and monitoring interface for administrators to track user activity, revenue, and business metrics.

**Key Features**:
- Dashboard statistics (total users, new users, revenue, subscriptions)
- User management table with filtering and search
- Top users display
- CSV data export with date filtering
- Revenue calculations

**Main Connections**:
- **OverviewService**: Fetches user and subscription data
- **AppContextService**: Manages global overview data state
- **PlanService**: Provides plan information for revenue calculations
- **SubscriptionService**: Fetches user subscription data
- **AuthService**: Retrieves trading accounts for users

---

## Report Module

The `report` module provides comprehensive trading analytics and reporting functionality, displaying detailed trading statistics, visualizations, and historical data analysis.

**Purpose**: Serves as the main analytics dashboard for traders to analyze their trading performance, view PnL trends, and track strategy compliance.

**Key Features**:
- Trading statistics (Net PnL, Win Rate, Profit Factor, etc.)
- PnL visualization with filtering
- Trading calendar with daily breakdown
- Win/Loss analysis
- Strategy compliance tracking
- Data persistence in localStorage

**Main Connections**:
- **ReportService**: Fetches trading data from TradeLocker API
- **AppContextService**: Global state management for user, accounts, and strategies
- **Store (NgRx)**: Local state management for report data
- **TradeLockerApiService**: Direct API communication
- **MonthlyReportsService**: Manages monthly report data
- **PluginHistoryService**: Tracks plugin activation for strategy adherence
- **TimezoneService**: Handles timezone conversions
- **SettingsService**: Strategy configuration

---

## Revenue Module

The `revenue` module provides revenue analytics and reporting functionality for administrators, displaying revenue data, orders, and subscriptions.

**Purpose**: Provides administrators with comprehensive revenue analytics including gross revenue, returns, coupons, net revenue, orders, and subscriptions.

**Key Features**:
- Revenue summary metrics
- Revenue charts (daily/monthly trends)
- Revenue, orders, and subscriptions tables
- Filtering and pagination

**Main Connections**:
- **ReportService**: For fetching user keys and historical data (future implementation)
- **Store (NgRx)**: For accessing user data
- Currently uses mock data for development

---

## Trading Accounts Module

The `trading-accounts` module provides functionality for managing user trading accounts, allowing users to view, add, edit, and delete their trading accounts.

**Purpose**: Enables users to manage their trading accounts, view account balances, and ensure compliance with plan limitations.

**Key Features**:
- Account display with filtering and sorting
- Account management (add, edit, delete)
- Real-time balance fetching
- Plan limitations enforcement
- Account deletion confirmation

**Main Connections**:
- **AuthService**: Account CRUD operations in Firebase
- **ReportService**: Fetching account balances and user keys
- **PlanLimitationsGuard**: Checking plan limitations
- **AppContextService**: Global state management for accounts
- **TradeLockerApiService**: Balance and account validation

---

## Strategy Module

The `strategy` module provides comprehensive trading strategy management functionality, allowing users to create, configure, activate, copy, and delete trading strategies.

**Purpose**: Provides users with tools to create and manage trading strategies that automate rule enforcement for their trading activities.

**Key Features**:
- Multiple strategy support
- Six configurable trading rules (risk/reward, risk per trade, max daily trades, days allowed, trading hours, assets allowed)
- Strategy activation/deactivation
- Strategy caching for performance
- Plan limitations enforcement
- Strategy guide for first-time users

**Main Connections**:
- **SettingsService**: CRUD operations for strategies
- **StrategyCacheService**: Caching strategy data
- **BalanceCacheService**: Caching account balances
- **PlanLimitationsGuard**: Checking plan limitations
- **AppContextService**: Global state management
- **StrategyOperationsService**: Direct Firebase operations
- **GlobalStrategyUpdaterService**: Global strategy updates
- **Store (NgRx)**: Local state for strategy rules

---

## Users Details Module

The `users-details` module provides administrative functionality for managing users, allowing administrators to view, ban/unban users, send password reset links, and create new users.

**Purpose**: Provides administrators with tools to manage users, perform administrative actions, and create new user accounts.

**Key Features**:
- User table with filtering and sorting
- User details modal
- Ban/unban users with reason tracking
- Password reset functionality
- Logout everywhere (token revocation)
- Create new users (user or admin roles)
- Status classification (banned, created, active)

**Main Connections**:
- **UserManagementService**: Fetches and updates user data
- **AuthService**: Handles password reset and token revocation
- **ReasonsService**: Manages ban reason records
- **AppContextService**: Provides current user data and loading states
- **AlertService**: Shows success/error notifications
- **SubscriptionService**: Creates free subscriptions for new users

---

## Guards

Guards are Angular route protection mechanisms that control access to routes based on authentication status, user roles, and plan limitations.

**Auth Guard** (`guards/auth-guard-guard.ts`): Protects routes requiring authentication, verifies user status, and blocks banned users.

**Plan Limitations Guard** (`guards/plan-limitations.guard.ts`): Validates user plan limitations and feature access, checking subscription status and resource limits.

**Redirect Guard** (`guards/redirect-guard.guard.ts`): Handles post-authentication routing based on user role (admins → overview, users → strategy).

**Main Connections**:
- **AuthService**: Authentication verification
- **SubscriptionService**: Plan and subscription data
- **PlanService**: Plan limits information
- **ReasonsService**: Ban reason retrieval
- **AppContextService**: Cached plan data
- **Store (NgRx)**: Current user state

---

## App Context Service

The `AppContextService` (`shared/context/context.ts`) provides global application state management using Angular signals and RxJS observables.

**Purpose**: Centralizes state management across the entire application, managing user data, accounts, strategies, plans, trading history, and API caching.

**Key Features**:
- User state management
- Account and strategy CRUD operations
- Plan management (user plan, global plans, limits)
- Trading history with localStorage persistence
- API caching (TradeLocker: 5-min TTL, general: 10-min TTL)
- Loading and error states per component
- Computed signals for derived data

**Main Connections**:
- **TradeLockerApiService**: Fetches trading data
- **All feature modules**: Consume and update context data
- **localStorage**: Persists trading history
- Used throughout the application as the single source of truth

---

## Store (NgRx)

The application uses NgRx for centralized state management, combining all feature module states into a single root state.

**App State** (`store/app.state.ts`): Defines the root state structure with three slices:
- `strategy`: Strategy rule configurations
- `report`: Report data and statistics
- `user`: User authentication and profile data

**App Reducer** (`store/app.reducer.ts`): Combines all feature module reducers into a single root reducer.

**Main Connections**:
- **StrategyReducer**: From strategy module
- **ReportReducer**: From report module
- **UserReducer**: From auth module
- Used throughout the application for state management

---

## Firebase Configuration

The Firebase configuration (`firebase/firebase-config.ts`) loads credentials from environment variables to avoid hardcoding sensitive information.

**Purpose**: Provides secure Firebase configuration by reading credentials from environment variables.

**Key Features**:
- No hardcoded credentials
- Environment variable-based configuration
- Fallback support

**Main Connections**:
- **firebase.init.ts**: Uses this configuration to initialize Firebase
- **.env file**: Source of environment variables
