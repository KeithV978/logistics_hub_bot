# Product Requirements Document (PRD) for Copilot Agent Telegram Bot

## 1. Overview
The Copilot Agent is a Telegram bot designed to facilitate logistics and errand services by connecting users with verified riders (for deliveries) and erranders (for errands). The bot enables registration, verification, order/errand creation, offer management, transaction handling, and post-transaction reviews within the Telegram platform.

### 1.1 Purpose
To provide a seamless, secure, and efficient platform for users to create logistics orders and errands, and for riders and erranders to accept and fulfill these requests, all within Telegram.

### 1.2 Scope
The bot will include:
- Registration and verification for riders and erranders.
- Order and errand creation with location-based notifications.
- Offer system for riders and erranders.
- Private group chats for transactions.
- Transaction completion and review system.

## 2. Features and Requirements

### 2.1 Rider Registration
- **Description**: Riders can register to offer logistics services.
- **Details Captured**:
  - Telegram ID (auto-captured).
  - Full name.
  - Phone number.
  - Bank account details (e.g., account number, bank name).
  - Photograph (selfie or ID photo).
  - Rating and review (initially empty, updated post-transaction).
  - Current Location (Updated when rider want's to see orders within the specified location)
- **Input Method**: Bot prompts user to submit details via text or file upload.
- **Storage**: Securely store data in a postgres database, encrypted where applicable (e.g., bank details).
- **Verification**: Account remains inactive until verified (see 2.3).

### 2.2 Errander Registration
- **Description**: Erranders can register to offer errand-running services (e.g., purchasing items).
- **Details Captured**:
  - Same as rider registration: Telegram ID, full name, phone number, bank account details, photograph, rating, and review.
- **Input Method**: Same as rider registration.
- **Storage**: Same as rider registration.
- **Verification**: Account remains inactive until verified (see 2.3).

### 2.3 Verification Process
- **Description**: Riders and erranders must be verified before activation.
- **Process**:
  - Submission of bank account details and supporting documents (e.g., ID, proof of address).
  - Manual or automated verification (e.g., bank account validation, document review).
- **Status**:
  - Pending: After registration, before verification.
  - Active: After successful verification.
  - Rejected: If documents are invalid, with feedback provided.
- **Notification**: Bot notifies user of verification status via Telegram message.
- **Security**: Documents stored securely, accessible only to authorized admins.

### 2.4 Order Creation (Logistics Request)
- **Description**: Users create logistics orders for pickup and drop-off.
- **Details Captured**:
  - Pickup location (address or geolocation).
  - Drop-off location (address or geolocation).
  - Optional: Item description, delivery instructions.
- **Process**:
  - User initiates order via bot command (e.g., `/create_order`).
  - Bot prompts for pickup and drop-off details.
  - Order is saved and broadcast to eligible riders.
- **Location-Based Notification**:
  - Riders within a 5km radius of the pickup location receive a notification with order details.
  - If no rider is found within the radius expand it by 5km until a rider is found.
  - Notification includes option to send an offer.

### 2.5 Errand Creation
- **Description**: Users create errands for tasks like purchasing items.
- **Details Captured**:
  - Location of errand (address or geolocation).
  - Task description (e.g., "buy groceries from X store").
  - Optional: Budget, deadline, additional instructions.
- **Process**:
  - User initiates errand via bot command (e.g., `/create_errand`).
  - Bot prompts for task details and location.
  - Errand is saved and broadcast to eligible erranders.
- **Location-Based Notification**:
  - Erranders within a 5km radius of the errand location receive a notification with errand details.
  - Notification includes option to send an offer.

### 2.6 Offer System
- **Description**: Riders and erranders send offers for orders and errands.
- **Process**:
  - Rider/errander selects an order/errand from notifications.
  - Submits offer via bot (e.g., price, estimated time).
  - User receives real-time notifications of incoming offers.
- **User Selection**:
  - User can view all offers and accept one (only one offer per order/errand).
  - Once accepted, other offers are rejected, and notifications sent to respective riders/erranders.
- **Lock-In**:
  - After acceptance, user and rider/errander are locked into the transaction.
  - Neither can create or accept new orders/errands until completion.

### 2.7 Private Group Chat
- **Description**: A private Telegram group is created for each accepted offer.
- **Participants**:
  - User, rider/errander, and bot (as admin).
- **Features**:
  - Free chat between user and rider/errander.
  - Option to start a group call.

- **Creation**:
  - Bot auto-creates group upon offer acceptance.
  - Group name includes transaction ID (e.g., "Order #123").
- **Access**:
  - Only participants can access the group.
  - Bot ensures no unauthorized additions.

### 2.8 Transaction Completion
- **Description**: Transactions are marked complete via commands.
- **Process**:
  - Rider/errander issues `/payment_received` command.
  - User issues `/delivery_successful` command.
  - Bot verifies both commands are received.
- **Group Deletion**:
  - Bot kicks all participants from the group.
  - Group is deleted, and chats are archived.
- **Error Handling**:
  - If only one command is received, bot prompts the other party.
  - Timeout (e.g., 24 hours) triggers admin intervention.

### 2.9 Rating and Review
- **Description**: Users rate and review riders/erranders post-transaction.
- **Process**:
  - After group deletion, bot sends user a notification to rate (1-5 stars) and leave a review.
  - Input via bot interface (e.g., buttons for rating, text for review).
- **Storage**:
  - Rating and review stored in rider/errander profile in the database.
  - Average rating calculated and displayed publicly.

- **Notification**:
  - Rider/errander notified of new rating/review.

### 2.10 Dispute creation
- **Description**: Users or riders/erranders can create dispute.
- **Process**:
- Using dispute command bot riders/erranders and users can create dispute
- A support staff is immediately added to the group when a dispute is created.


## 3. Technical Requirements

### 3.1 Platform
- Built as a Telegram bot using Telegram Bot API.
- Hosted on render.

### 3.2 Database
- PostgreSQL database is used for storage 
- Secure storage for:
  - Rider and errander profiles.
  - Orders, errands, and transaction history.
  - Ratings and reviews.
- Encryption for sensitive data (e.g., bank details, documents).


### 3.3 Geolocation
- Integration with telegram's geolocation API for:
  - Calculating 5km radius for notifications.
  - Validating pickup/drop-off/errand locations.

### 3.4 Notifications
- Real-time Telegram messages for:
  - Order/errand creation.
  - Offer submissions and acceptance.
  - Verification status.
  - Transaction updates.

### 3.5 Security
- End-to-end encryption for sensitive data.
- Secure document upload and storage.
- Role-based access for admins (e.g., for verification).

## 4. User Flows

### 4.1 Rider/Errander Registration
1. User starts bot, selects "Register as Rider" or "Errander."
2. Bot prompts for details (name, phone, bank account, photo).
3. User submits documents for verification.
4. Bot notifies user of pending status.
5. Admin verifies documents; bot updates status to active/rejected.

### 4.2 Order Creation and Fulfillment
1. User selects "Create Order."
2. Enters pickup and drop-off details.
3. Riders within 5km receive notification (If no rider is found within the specified radius expand redius by 5km repeatedly until a rider is found).
4. Riders send offers; user receives notifications.
5. User accepts one offer.
6. Bot creates private group with user, rider, and bot.
7. Rider delivers, issues `/payment_received`.
8. User confirms with `/delivery_successful`.
9. Bot deletes group, prompts user for rating/review.

### 4.3 Errand Creation and Fulfillment
1. User selects "Create Errand."
2. Enters task details and location.
3. Erranders within 5km receive notification (If no rider is found within the specified radius expand redius by 5km repeatedly until a rider is found).
4. Erranders send offers; user receives notifications.
5. User accepts one offer.
6. Bot creates private group with user, errander, and bot.
7. Errander completes task, issues `/payment_received`.
8. User confirms with `/delivery_successful`.
9. Bot deletes group, prompts user for rating/review.

## 5. Success Metrics
- **User Engagement**: Number of orders/errands created per week.
- **Rider/Errander Activation**: Percentage of registered riders/erranders verified and active.
- **Transaction Completion Rate**: Percentage of orders/errands marked complete.
- **User Satisfaction**: Average rating for riders/erranders.
- **Retention**: Percentage of users returning to create new orders/errands.

## 6. Risks and Mitigations
- **Risk**: Low rider/errander adoption.
  - **Mitigation**: Implement referral incentives and marketing campaigns.
- **Risk**: Fraudulent registrations (fake documents).
  - **Mitigation**: Use automated document verification and manual review.
- **Risk**: Disputes during transactions.
  - **Mitigation**: Provide dispute resolution with admin support; log chats.
- **Risk**: Privacy concerns with data storage.
  - **Mitigation**: Comply with GDPR/CCPA, use encryption.
- **Risk**: Bot downtime or slow notifications.
  - **Mitigation**: Use scalable hosting with redundancy.

## 7. Non-Functional Requirements
- **Performance**: Bot responds within 2 seconds under normal load.
- **Scalability**: Supports 10,000 active users, 1,000 concurrent transactions.
- **Availability**: 99.9% uptime with automated failover.
- **Localization**: Support for English, expandable to other languages.
- **Accessibility**: Commands designed for mobile ease of use.

## 8. Future Enhancements
- In-bot payment processing.
- AI-based matching for riders/erranders.
- Multi-order support for users.
- Analytics dashboard for riders/erranders.
- Insurance for high-value deliveries.

## 9. Dependencies
- Telegram Bot API for bot and group management.
- Geolocation API (e.g., Google Maps) for notifications.
- Render hosting (e.g., AWS) for scalability.
- Verification service for KYC (e.g., third-party provider).
- Database (e.g., PostgreSQL) for secure storage.

## 10. Timeline and Milestones
- **Phase 1 (2 months)**: Registration, verification, order/errand creation.
- **Phase 2 (1 month)**: Offer system, group chat, transaction completion.
- **Phase 3 (1 month)**: Rating/review, geolocation integration.
- **Phase 4 (1 month)**: Testing, bug fixes, security audits.
- **Phase 5**: Launch and onboarding.

## 11. Stakeholders
- **Product Owner**: Defines features, prioritizes backlog.
- **Development Team**: Builds and maintains bot.
- **Verification Team**: Handles document verification.
- **Users**: Create orders/errands.
- **Riders/Erranders**: Fulfill requests.
- **Admins**: Oversee operations and disputes.

## 12. Approval
- Requires approval from product owner and stakeholders.
- Feedback will be incorporated as needed.
 