# User Guide - TradeSwitch App

## 📋 Summary of Changes

### Main Improvements

1. **External Backend Architecture** ⭐ *Main Change*
   - Full migration of business logic to a dedicated external backend
   - All communications with TradeLocker now go through our own backend
   - Improved security and protection of credentials
   - Better performance and scalability
   - Centralized business logic for easier maintenance and updates

2. **Trading Account Management**
   - Improved system for adding, editing, and deleting trading accounts
   - Automatic account validation with TradeLocker
   - Real-time balance display

3. **Strategy System**
   - Create and manage multiple trading strategies
   - Custom rule configuration (risk/reward, daily limits, schedules, etc.)
   - Enable/disable strategies
   - Integrated guide for new users

4. **Reports and Analysis**
   - Full dashboard with trading statistics
   - PnL (profit/loss) charts
   - Trades calendar
   - Winning/losing trades analysis
   - Strategy compliance tracking

5. **Plan and Subscription Management**
   - Plan system with different tiers
   - Subscription update and cancellation
   - Subscription history

6. **TradeLocker Integration**
   - All connections to TradeLocker are made through the external backend
   - Improved security for credentials and token handling
   - Automatic trading data sync
   - Improved credential validation

---

## 🚀 How the App Works - Quick Example

### Basic Usage Flow

1. **Login**
   - Sign in with your email and password
   - The system redirects you according to your role (user or administrator)

2. **Add a Trading Account**
   - Go to "Trading Accounts" in the menu
   - Click "Add Account"
   - Fill in the form with:
     - Account name
     - Broker (short name, e.g. "ICMarkets")
     - Server (must match the broker, short name)
     - Trading account email
     - Broker password
     - Account ID
     - Account number
     - Initial balance
   - The system will automatically validate the account with TradeLocker

3. **Create a Strategy**
   - Go to the "Strategy" section
   - Click "Create Strategy"
   - Configure the rules:
     - Risk/reward ratio
     - Risk per trade
     - Maximum daily trades
     - Allowed trading days
     - Trading hours
     - Allowed assets
   - Enable the strategy when ready

4. **View Reports**
   - Open the "Report" section
   - Select the account you want to analyze
   - View:
     - General statistics (Net PnL, Win Rate, Profit Factor)
     - Performance charts
     - Trades calendar
     - Winning/losing trades analysis

5. **Manage Your Account**
   - Go to "Account" in the menu
   - Edit your profile, change your password
   - Manage your subscription plan
   - Review your subscription history

---

## ⚠️ Important Tips and Recommendations

### 🔄 Loading Issues

**If the app keeps loading:**
- Refresh the browser window (F5 or Ctrl+R)
- If it continues, close and reopen the browser
- Check your internet connection

### 📝 When Adding TradeLocker Accounts

**IMPORTANT - Server and Broker fields:**
- The **Server** and **Broker** fields must have the **same value**
- Use the **short name** of the broker (e.g. "ICMarkets", "FXCM", "OANDA")
- Do not use long names or full descriptions
- Correct example:
  - Broker: `ICMarkets`
  - Server: `ICMarkets`
- Incorrect example:
  - Broker: `IC Markets Global Limited`
  - Server: `IC Markets - Demo Server`

### ✅ Best Practices

1. **Account Names**
   - Use short, descriptive names for your accounts
   - Example: "Main Account", "Demo Testing", "EUR Account"

2. **Strategies**
   - Start with simple strategies and adjust based on your results
   - Regularly check strategy compliance in reports
   - You can have multiple strategies active at the same time

3. **Reports**
   - Data is updated automatically every 5 minutes
   - Reports are stored in your browser for quick access
   - You can filter by date for specific analysis

4. **Security**
   - Do not share your trading credentials
   - Change your password regularly
   - Log out if you use a shared computer

5. **Plan Limits**
   - Your plan has limits on:
     - Number of trading accounts
     - Number of strategies
   - You will see notifications when you approach the limits
   - You can upgrade your plan anytime from "Account"

### 🔍 Common Troubleshooting

**Account validation error:**
- Verify that the email, password, and server are correct
- Ensure the server and broker have the same value (short name)
- Confirm that the account exists in TradeLocker

**No data in reports:**
- Verify that the account is configured correctly
- Wait a few minutes for data to sync
- Refresh the page if needed

**Strategy won’t enable:**
- Check that all required fields are filled
- Check that you have not reached your plan’s strategy limit
- Ensure at least one account is linked

---

## 🎯 Quick Summary

- ⭐ **External backend**: All logic now runs through a dedicated backend for better security
- ✅ **If it keeps loading**: Refresh the window (F5)
- ✅ **Server and Broker**: Must be the same and use the short name
- ✅ **Automatic validation**: Accounts are validated with TradeLocker when created
- ✅ **Multiple strategies**: You can create and manage several strategies
- ✅ **Real-time reports**: Data is updated every 5 minutes
- ✅ **Plan limits**: Check your plan for your limits

---
