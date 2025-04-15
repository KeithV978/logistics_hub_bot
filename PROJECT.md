# Product Requirements Document (PRD): Telegram Bot for Logistics and Errand Services

## 1. Overview
This Telegram bot facilitates logistics and errand services, connecting customers with riders (for deliveries) and erranders (for errands). It supports three user roles: customers, riders, and erranders, with distinct functionalities for each. The bot uses webhooks for real-time updates, incorporates robust error handling, and now includes live tracking of riders and erranders for enhanced transparency.

---

## 2. Objectives
- Enable customers to create delivery orders and errands without registration.
- Allow riders and erranders to register, get verified, and accept jobs.
- Ensure seamless communication between customers, riders, and erranders.
- Automate notifications, offer management, transaction completion, and live tracking.
- Maintain a secure and reliable system using webhooks and error handling best practices.

---

## 3. User Roles
The bot supports three user roles with the following capabilities:

1. **Customer**:
   - No registration required.
   - Can create orders (logistics requests) or errands (e.g., buying items).
   - Receives notifications about available riders/erranders and their offers.
   - Accepts one offer per order/errand.
   - Communicates with the rider/errander in a private group.
   - Tracks rider/errander location in real-time after offer acceptance.
   - Rates and reviews riders/erranders after transaction completion.

2. **Rider**:
   - Must register and be verified to accept orders.
   - Receives order notifications within a dynamic radius (3km, expandable to 12km).
   - Submits offers to customers with details (price, rating, vehicle type).
   - Shares live location with the customer during the transaction.
   - Communicates with customers in a private group.
   - Marks transactions as complete and receives ratings/reviews.

3. **Errander (Errand Runner)**:
   - Must register and be verified to accept errands.
   - Receives errand notifications within a dynamic radius (2km, expandable to 6km).
   - Submits offers to customers with details (price, rating).
   - Shares live location with the customer during the transaction.
   - Communicates with customers in a private group.
   - Marks transactions as complete and receives ratings/reviews.

---

## 4. Features and Functional Requirements

### 4.1 User Registration and Verification
- **Riders and Erranders**:
  - **Registration Details**:
    - Telegram ID (auto-captured).
    - Full name.
    - Phone number.
    - Bank account details.
    - Photograph.
    - National Identification Number (NIN).
  - **Verification Process**:
    - Submission of bank account details, NIN, and other documents (e.g., ID scan).
    - NIN verification via an external API (e.g., third-party NIN verification service).
    - Manual review of other documents by admin (optional for enhanced security).
    - Profile remains inactive until verification is complete.
  - **Error Handling**:
    - Validate input formats (e.g., phone number, bank account).
    - Handle API failures for NIN verification with fallback (e.g., retry or manual review).
    - Notify users of incomplete or invalid submissions with clear instructions.

- **Customers**:
  - No registration required; identified by Telegram ID for transactions.

### 4.2 Order Creation (Logistics)
- **Customer Action**:
  - Command: `/create_order`.
  - Inputs:
    - Pickup location (text or shared location).
    - Drop-off location (text or shared location).
    - Delivery instructions (optional, e.g., "leave at gate").
  - Validation:
    - Ensure locations are valid (e.g., within service area).
    - Handle missing or ambiguous inputs with user prompts.
- **System Action**:
  - Search for verified riders within 3km of the pickup location.
  - If no riders found, expand radius by 3km increments (up to 12km).
  - Notify customer:
    - If riders found: "X riders found. Please wait for offers."
    - If no riders found at 12km: "No riders available. Please try again later."
  - Notify riders within radius with order details (pickup, drop-off, instructions).
- **Error Handling**:
  - Handle invalid location inputs (e.g., unreachable areas).
  - Manage webhook failures (e.g., retry notifications).

### 4.3 Errand Creation
- **Customer Action**:
  - Command: `/create_errand`.
  - Inputs:
    - Errand location (text or shared location).
    - Errand details (e.g., "buy groceries from Store X").
  - Validation:
    - Ensure location and details are clear.
    - Prompt user for clarification if inputs are vague.
- **System Action**:
  - Search for verified erranders within 2km of the errand location.
  - If no erranders found, expand radius by 1km increments (up to 6km).
  - Notify customer:
    - If erranders found: "X erranders found. Please wait for offers."
    - If no erranders found at 6km: "No erranders available. Please try again later."
  - Notify erranders within radius with errand details (location, instructions).
- **Error Handling**:
  - Handle ambiguous errand requests with user clarification prompts.
  - Ensure webhook delivery for notifications.

### 4.4 Offer Management
- **Rider/Errander Action**:
  - Receive order/errand notification with details.
  - Submit offer via command: `/make_offer [order/errand ID] [price]`.
  - Offer includes:
    - Price (set by rider/errander).
    - Rating (from past reviews).
    - Vehicle type (riders only, e.g., bike, car).
- **Customer Action**:
  - Receive real-time notifications for each offer:
    - "New offer from [Rider/Errander Name]: $[Price], Rating: [X/5], Vehicle: [Type]."
  - View all offers and select one via command: `/accept_offer [offer ID]`.
  - Can only accept one offer per order/errand.
- **System Action**:
  - Lock customer and selected rider/errander to prevent concurrent transactions.
  - Notify other riders/erranders: "This order/errand has been taken."
- **Error Handling**:
  - Prevent duplicate offers for the same order/errand.
  - Handle invalid offer submissions (e.g., negative price).
  - Timeout offers after a set period (e.g., 10 minutes) if no acceptance.

### 4.5 Live Tracking
- **Rider/Errander Action**:
  - After offer acceptance, prompted to share live location via Telegram’s live location feature.
  - Command: `/start_tracking` (optional, auto-prompted by bot).
  - Continue sharing location until transaction completion (i.e., `/payment_received`).
- **Customer Action**:
  - Receives rider/errander’s live location in the private group.
  - Can view real-time updates of rider/errander’s position (e.g., moving toward pickup or errand location).
  - Command: `/view_tracking` (optional, as location updates are shared automatically in group).
- **System Action**:
  - Enable live location sharing in the private group upon offer acceptance.
  - Monitor rider/errander’s location updates via Telegram API.
  - Notify customer if live tracking is interrupted (e.g., rider/errander stops sharing).
  - Stop tracking when transaction is marked complete (both `/payment_received` and `/delivery_successful` received).
- **Error Handling**:
  - Handle cases where rider/errander fails to share location (e.g., prompt again or notify customer).
  - Manage Telegram API limits for live location updates (e.g., fallback to periodic updates).
  - Ensure privacy by restricting location access to the private group only.

### 4.6 Private Group Communication
- **System Action**:
  - Upon offer acceptance, create a private Telegram group with:
    - Customer.
    - Rider/Errander.
    - Bot (as admin).
  - Bot posts a "Rules of Engagement" message (e.g., "Be respectful, share updates, report issues to admin").
  - Bot enables live location sharing for rider/errander in the group.
- **User Actions**:
  - Customer and rider/errander can chat freely to coordinate (e.g., share updates, clarify instructions).
  - Customer views rider/errander’s live location in the group.
- **Error Handling**:
  - Handle group creation failures (e.g., Telegram API limits).
  - Log inappropriate messages for admin review (optional).
  - Ensure live location is only accessible within the group.

### 4.7 Transaction Completion
- **Rider/Errander Action**:
  - Command: `/payment_received`.
  - Confirms they have received payment from the customer.
  - Stops live location sharing automatically.
- **Customer Action**:
  - Command: `/delivery_successful`.
  - Confirms the order/errand was completed successfully.
- **System Action**:
  - Upon receiving both commands:
    - Kick all members from the private group.
    - Delete the group.
    - Unlock customer and rider/errander for new transactions.
  - Prompt customer to rate/review rider/errander:
    - Command: `/rate [rider/errander ID] [1-5] [review text]`.
  - Update rider/errander’s rating and store review.
- **Error Handling**:
  - Handle missing commands (e.g., timeout after 24 hours with reminder).
  - Validate rating inputs (e.g., 1-5 scale).
  - Ensure live tracking stops before group deletion.

### 4.8 Notifications
- Use Telegram webhooks for real-time updates:
  - Rider/Errander notifications for new orders/errands.
  - Customer notifications for rider/errander availability, offers, transaction status, and live tracking updates.
  - Group creation and completion notifications.
- **Error Handling**:
  - Retry failed webhook deliveries (e.g., up to 3 attempts).
  - Log notification failures for debugging.

### 4.9 Rating and Review
- Customers rate riders/erranders (1-5 stars) and provide optional text reviews.
- Ratings are averaged and displayed in rider/errander profiles and offers.
- **Error Handling**:
  - Prevent multiple ratings for the same transaction.
  - Validate rating format.

---

## 5. Technical Requirements

### 5.1 Webhooks
- Use Telegram Bot API webhooks for real-time message processing.
- Endpoint to handle:
  - User commands (e.g., `/create_order`, `/make_offer`, `/start_tracking`).
  - Location sharing (including live location updates).
  - Group chat messages.
- Secure webhook endpoint with authentication (e.g., secret token).

### 5.2 Error Handling
- **Input Validation**:
  - Validate all user inputs (e.g., location, price, rating).
  - Provide clear error messages (e.g., "Invalid location. Please try again").
- **API Failures**:
  - Retry NIN API calls on timeout (up to 3 attempts).
  - Fallback to manual verification if API is unavailable.
- **Webhook Failures**:
  - Retry failed notifications (up to 3 attempts).
  - Handle live location update failures (e.g., prompt rider/errander to restart).
  - Log failures for monitoring.
- **Concurrency**:
  - Prevent race conditions during offer acceptance (e.g., lock order/errand).
  - Ensure single active transaction per user.
- **Timeouts**:
  - Expire orders/errands if no offers received (e.g., 15 minutes).
  - Expire offers if not accepted (e.g., 10 minutes).
  - Timeout transactions if no completion commands (e.g., 24 hours).
  - Timeout live tracking if no updates (e.g., 5 minutes with notification).

### 5.3 External APIs
- **NIN Verification API**:
  - Integrate with a third-party service for automatic NIN validation.
  - Handle API errors (e.g., invalid NIN, service downtime).
- **Geolocation**:
  - Use a geolocation API (e.g., Google Maps) to:
    - Validate pickup/errand locations.
    - Calculate distances for rider/errander radius search.
    - Process live location updates for tracking.
- **Telegram API**:
  - Support live location sharing and updates.
  - Handle group creation and message broadcasting.

### 5.4 Database
- Use Postgres for database type.
- Store:
  - Rider/Errander profiles (Telegram ID, name, phone, bank details, photo, NIN, verification status, rating, reviews).
  - Orders/Errands (ID, customer Telegram ID, locations, instructions, status).
  - Offers (ID, order/errand ID, rider/errander ID, price, vehicle type, status).
  - Transaction logs (for debugging and disputes).
  - Live tracking sessions (rider/errander ID, order/errand ID, location updates, status).
- Ensure data encryption for sensitive fields (e.g., bank details, NIN, location data).

---

## 6. Non-Functional Requirements
- **Performance**:
  - Handle up to 1,000 concurrent users.
  - Process commands within 2 seconds.
  - Send notifications and location updates within 1 second.
- **Scalability**:
  - Support dynamic radius search for thousands of riders/erranders.
  - Scale webhook processing with load balancing.
  - Handle multiple live tracking sessions simultaneously.
- **Security**:
  - Encrypt sensitive data (bank details, NIN, location data).
  - Authenticate webhook requests.
  - Prevent command abuse (e.g., rate-limit commands).
  - Restrict live location access to the relevant private group.
- **Reliability**:
  - Achieve 99.9% uptime.
  - Log errors for monitoring and debugging.
- **Usability**:
  - Clear command syntax and error messages.
  - Intuitive flow for offer selection, group communication, and live tracking.

---

## 7. User Flow Example

### Order (Logistics)
1. Customer: `/create_order`.
2. Bot: Prompts for pickup, drop-off, and instructions.
3. Customer: Submits details.
4. Bot: Searches for riders within 3km (expands if needed).
5. Bot: Notifies customer ("5 riders found") and riders (order details).
6. Rider: `/make_offer [order ID] 10` (price: $10).
7. Bot: Notifies customer of offer ("Rider John: $10, Rating: 4.5, Bike").
8. Customer: `/accept_offer [offer ID]`.
9. Bot: Creates private group, posts rules, prompts rider to share live location.
10. Rider: `/start_tracking` (or shares live location manually).
11. Customer: Views rider’s live location in the group (e.g., moving to pickup).
12. Customer and rider: Chat to coordinate.
13. Rider: `/payment_received` (stops live tracking).
14. Customer: `/delivery_successful`.
15. Bot: Deletes group, prompts customer to rate.
16. Customer: `/rate [rider ID] 5 Great service!`.

### Errand
1. Customer: `/create_errand`.
2. Bot: Prompts for location and details.
3. Customer: Submits details (e.g., "Buy milk from Store X").
4. Bot: Searches for erranders within 2km (expands if needed).
5. Bot: Notifies customer ("3 erranders found") and erranders (errand details).
6. Errander: `/make_offer [errand ID] 15` (price: $15).
7. Bot: Notifies customer of offer ("Errander Jane: $15, Rating: 4.8").
8. Customer: `/accept_offer [offer ID]`.
9. Bot: Creates private group, posts rules, prompts errander to share live location.
10. Errander: `/start_tracking` (or shares live location manually).
11. Customer: Views errander’s live location in the group (e.g., heading to store).
12. Customer and errander: Chat to coordinate.
13. Errander: `/payment_received` (stops live tracking).
14. Customer: `/delivery_successful`.
15. Bot: Deletes group, prompts customer to rate.
16. Customer: `/rate [errander ID] 4 Quick and friendly`.

---

## 8. Assumptions
- Telegram Bot API supports all required functionalities (groups, webhooks, live location).
- NIN verification API is reliable and available.
- Users have Telegram installed and can share locations (including live location).
- Payment happens offline (bot only confirms receipt).
- Riders/erranders have devices capable of sharing live location.

---

## 9. Future Enhancements
- In-bot payment integration.
- Admin dashboard for verification and dispute resolution.
- Multi-language support.
- Scheduled orders/errands.

---

## 10. Acceptance Criteria
- Customers can create orders/errands without registration.
- Riders/erranders can register, submit verification details, and get verified.
- NIN verification works via API with fallback for failures.
- Dynamic radius search (3km to 12km) notifies riders/erranders.
- Customers receive and accept offers with clear details.
- Private groups are created and deleted as expected.
- Live tracking:
  - Riders/erranders can share live location after offer acceptance.
  - Customers can view real-time location updates in the private group.
  - Tracking stops upon transaction completion.
  - Errors (e.g., failure to share location) are handled with prompts/notifications.
- Transaction completion requires both `/payment_received` and `/delivery_successful`.
- Ratings/reviews are stored and displayed correctly.
- Webhooks handle all interactions (including live tracking) in real-time.
- Error handling covers invalid inputs, API failures, timeouts, and tracking issues.

---

*Last Updated: April 14, 2025*