# **App Name**: BasePay

## Core Features:

- Escrow Creation via WhatsApp: Allows sellers to initiate an escrow transaction directly via WhatsApp command, specifying the buyer's number, amount, and item description. The system should be able to parse all relevant values and call BlockchainService.
- Dynamic Payment Instruction Generation: Generates personalized payment instructions that will be sent to the buyer, with escrow ID and all relevant parameters such as amounts and token details.
- Blockchain Payment Monitoring: Automatically detects when the buyer makes a payment to the escrow contract and calls the smart contract's fundEscrow function.
- Automated Delivery Confirmation Request: Send reminders via Whatsapp for delivery confirmation requests. Use tool to use an LLM chain to decide to provide gentle or stronger language.
- Dispute Resolution: Enables users to raise disputes if they encounter any issues, handled via the DisputeService to pause funds and allow admin intervention.
- Automated Fund Release: If buyers do not respond funds will be automatically released after a preset amount of time.
- Transaction History Retrieval: The system will allow any user to retrieve their complete history of payments and transactions. In order to do this, it calls a the EscrowService's getUserEscrows.

## Style Guidelines:

- Primary color: Strong blue (#2962FF) to represent trust and security.
- Background color: Light blue (#E6F0FF) to ensure a clean, readable interface.
- Accent color: A shade of green (#00A36C) to indicate success.
- Body and headline font: 'Inter' for a clear, modern and neutral style, ensuring legibility across all devices. Inter is a sans-serif.
- Code font: 'Source Code Pro' for displaying code snippets, important addresses.
- Simple, outlined icons from a set like Phosphor Icons, providing a consistent and modern visual language.
- Subtle animations and transitions for key interactions to improve usability without being distracting.