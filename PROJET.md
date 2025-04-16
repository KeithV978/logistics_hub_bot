# Product Requirements Document (PRD): Telegram Bot for Logistics and Errands

## 1. Overview
This Telegram bot facilitates logistics (orders) and errand services by connecting customers with verified riders and erranders. Customers can create orders or errands without registration, while riders and erranders must register and be verified to participate. The bot uses a session-based approach, webhooks for real-time updates, and incorporates best practices for error handling and logging.

---

## 2. Objectives
- Enable customers to create logistics orders (pickup and drop-off) and errands (e.g., buying items) seamlessly via Telegram.
- Allow riders and erranders to register, get verified, and accept orders/errands.
- Ensure secure and efficient matching of customers with nearby riders/erranders using location-based notifications.
- Provide a transparent offer system where customers can choose from multiple rider/errander offers.
- Facilitate communication between parties in a private group during transactions.
- Ensure robust error handling, logging, and system reliability.

---

## 3. Technical Requirements
### 3.1 Technology Stack
- **Backend**: Node.js
- **Database**: PostgreSQL
- **Telegram Integration**: Webhooks (no polling) for real-time updates
- **External APIs**:
  - National Identification Number (NIN) verification API
  - Geolocation API for calculating distances and live location sharing
- **Error Handling**: Implement best practices (try-catch, custom error classes, centralized error logging)
- **Logging**: Structured logging (e.g., Winston or Bunyan) for errors, warnings, and key events
- **Session Management**: Session-based approach for order/errand creation, rider/errander registration, and task tracking

### 3.2 Database Schema (High-Level)
- **Users**:
  - `telegramId` (unique, string)
  - `role` (enum: rider, errander)
  - `fullName` (string)
  - `phoneNumber` (string)
  - `bankDetails` (JSON: {accountName, accountNumber, bankName})
  - `nin` (string)
  - `photoUrl` (string)
  - `rating` (float, default: 0)
  - `reviews` (array of JSON: {customerId, comment, rating})
  - `isVerified` (boolean, default: false)
  - `createdAt`, `updatedAt` (timestamps)
- **Orders**:
  - `orderId` (UUID)
  - `customerTelegramId` (string)
  - `pickupLocation` (JSON: {lat, lng, address})
  - `dropoffLocation` (JSON: {lat, lng, address})
  - `instructions` (string, optional)
  - `status` (enum: pending, offered, accepted, in_progress, completed, canceled)
  - `riderId` (foreign key, nullable)
  - `createdAt`, `updatedAt` (timestamps)
- **Errands**:
  - `errandId` (UUID)
  - `customerTelegramId` (string)
  - `location` (JSON: {lat, lng, address})
  - `description` (string)
  - `status` (enum: pending, offered, accepted, in_progress, completed, canceled)
  - `erranderId` (foreign key, nullable)
  - `createdAt`, `updatedAt` (timestamps)
- **Offers**:
  - `offerId` (UUID)
  - `orderId` or `errandId` (foreign key)
  - `riderId` or `erranderId` (foreign key)
  - `price` (float)
  - `vehicleType` (string, nullable, for riders only)
  - `status` (enum: pending, accepted, rejected)
  - `createdAt` (timestamp)
- **Sessions**:
  - `sessionId` (UUID)
  - `telegramId` (string)
  - `data` (JSON: temporary data for order/errand creation or registration)
  - `expiresAt` (timestamp)
- **Groups**:
  - `groupId` (string, Telegram group ID)
  - `orderId` or `errandId` (foreign key)
  - `customerTelegramId` (string)
  - `riderId` or `erranderId` (foreign key)
  - `createdAt` (timestamp)

---

## 4. Functional Requirements

### 4.1 User Roles
- **Customers**: Unregistered users who can create orders or errands.
- **Riders**: Registered and verified users handling logistics orders.
- **Erranders**: Registered and verified users handling errands.

### 4.2 Registration and Verification
- **Rider/Errander Registration**:
  - Collect: `telegramId`, `fullName`, `phoneNumber`, `bankDetails` (accountName, accountNumber, bankName), `nin`, `photo`.
  - Store registration data in a session until submission.
  - Submit for verification:
    - Validate `nin` using an external NIN API.
    - Manually verify `bankDetails` and `photo` (future: automate bank verification if API available).
    - Set `isVerified` to `true` upon successful verification.
  - Notify rider/errander of verification status via Telegram.
- **Profile**:
  - Riders/erranders can view their profile (ratings, reviews, verification status).
  - Only verified riders/erranders can accept orders/errands.

### 4.3 Order Creation (Logistics)
- **Flow**:
  1. Customer initiates order creation via command (e.g., `/create_order`).
  2. Bot guides customer through session-based input:
     - Pickup location (text or shared location).
     - Drop-off location (text or shared location).
     - Optional delivery instructions.
  3. Bot stores order in database with `status: pending`.
  4. Bot searches for verified riders within a 3km radius of pickup location.
     - If none found, increase radius by 3km (up to 12km).
     - If no riders found at 12km, notify customer: "No riders available. Please try again later."
  5. Notify found riders with order details (pickup, drop-off, instructions).
  6. Notify customer: "Found X riders. Please wait for offers."
- **Offers**:
  - Riders send offers via command (e.g., `/offer <orderId> <price> <vehicleType>`).
  - Offer details: `price`, `riderRating`, `vehicleType`.
  - Customer receives real-time notifications for each offer.
  - Customer selects one offer via command (e.g., `/accept_offer <offerId>`).
  - Bot locks customer and rider (no new transactions until current one completes).
  - Notify other riders: "Order taken by another rider."
- **Private Group**:
  - Bot creates a private Telegram group with customer, rider, and bot (bot as admin).
  - Bot posts "RULES OF ENGAGEMENT" (e.g., no abusive language, share live location, etc.).
  - Rider prompted to share live location.
  - Customer and rider can chat freely.
- **Completion**:
  - Rider issues `/payment_received`.
  - Customer issues `/delivery_successful`.
  - Bot verifies both commands, kicks all members, and deletes group.
  - Bot prompts customer to rate/review rider (1-5 stars, optional comment).
  - Update rider’s `rating` (average of all ratings).

### 4.4 Errand Creation
- **Flow**:
  1. Customer initiates errand creation via command (e.g., `/create_errand`).
  2. Bot guides customer through session-based input:
     - Location (text or shared location).
     - Errand description (e.g., "Buy groceries from Store X").
  3. Bot stores errand in database with `status: pending`.
  4. Bot searches for verified erranders within a 3km radius of location.
     - If none found, increase radius by 2km (up to 6km).
     - If no erranders found at 6km, notify customer: "No erranders available."
  5. Notify found erranders with errand details (location, description).
  6. Notify customer: "Found X erranders. Please wait for offers."
- **Offers**:
  - Erranders send offers via command (e.g., `/offer <errandId> <price>`).
  - Offer details: `price`, `erranderRating`.
  - Customer receives real-time notifications for each offer.
  - Customer selects one offer via command (e.g., `/accept_offer <offerId>`).
  - Bot locks customer and errander.
  - Notify other erranders: "Errand taken by another errander."
- **Private Group**:
  - Same as order group (bot creates group, posts rules, prompts live location, etc.).
- **Completion**:
  - Errander issues `/payment_received`.
  - Customer issues `/delivery_successful`.
  - Bot verifies, deletes group, and prompts customer to rate/review errander.

### 4.5 Notifications
- Real-time notifications via Telegram for:
  - Rider/errander verification status.
  - Order/errand creation confirmation.
  - Rider/errander found (or not found).
  - Offer received/accepted/rejected.
  - Group creation and transaction completion.
  - Rating/review prompts.

### 4.6 Error Handling
- **Validation**:
  - Validate user inputs (e.g., valid phone number, location coordinates).
  - Ensure `nin` format is correct before API call.
- **Try-Catch**:
  - Wrap all database operations, API calls, and Telegram interactions.
- **Custom Errors**:
  - Define errors like `UserNotVerifiedError`, `NoRidersFoundError`, etc.
- **Logging**:
  - Log errors with stack traces, user context (e.g., `telegramId`), and timestamps.
  - Log key events (e.g., order created, offer accepted).
- **User Feedback**:
  - Gracefully handle errors with user-friendly messages (e.g., "Invalid location, please try again").

---

## 5. Non-Functional Requirements
- **Performance**:
  - Handle up to 1,000 concurrent users.
  - Respond to user commands within 2 seconds.
- **Scalability**:
  - Use connection pooling for PostgreSQL.
  - Support horizontal scaling for Node.js instances.
- **Security**:
  - Encrypt sensitive data (`nin`, `bankDetails`) in database.
  - Validate Telegram webhook requests to prevent unauthorized access.
  - Limit session duration (e.g., 10 minutes for order creation).
- **Reliability**:
  - Ensure 99.9% uptime for webhook endpoint.
  - Implement retry logic for failed API calls (e.g., NIN verification).
- **Maintainability**:
  - Modular code structure (e.g., separate modules for orders, errands, users).
  - Comprehensive unit tests for critical flows (registration, offer system).

---

## 6. User Interface (Telegram Commands)
- **Customer**:
  - `/start`: Welcome message and menu.
  - `/create_order`: Start order creation.
  - `/create_errand`: Start errand creation.
  - `/accept_offer <offerId>`: Accept an offer.
  - `/delivery_successful`: Mark transaction as complete.
- **Rider/Errander**:
  - `/register`: Start registration.
  - `/profile`: View profile and verification status.
  - `/offer <orderId/errandId> <price> [vehicleType]`: Submit an offer.
  - `/payment_received`: Mark payment received.
- **General**:
  - `/help`: List available commands.

---

## 7. Assumptions
- Customers have Telegram installed and can share locations.
- Riders/erranders have valid NINs and bank accounts.
- NIN verification API is reliable and available.
- Telegram supports all required bot features (groups, live location, etc.).

---

## 8. Future Considerations
- Automate bank account verification via API.
- Add payment integration for in-app transactions.
- Support multiple languages.
- Implement analytics dashboard for system performance.

---

## 9. Success Metrics
- **User Engagement**:
  - 1,000 active customers within 3 months.
  - 500 registered riders/erranders within 3 months.
- **Transaction Success**:
  - 90% of orders/errands completed successfully.
- **Performance**:
  - Average offer acceptance time < 5 minutes.
  - System uptime > 99.9%.

---

## 10. Risks
- **NIN API Downtime**: Fallback to manual verification.
- **Low Rider/Errander Adoption**: Marketing campaigns to onboard users.
- **Scalability Issues**: Monitor performance and scale infrastructure as needed.

---
*Last Updated: April 15, 2025*