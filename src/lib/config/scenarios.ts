import type { Feature } from "./plans";
import type { SceneId } from "./modes";

export interface Scenario {
  id: string;
  category: "Daily life" | "Travel" | "Work" | "Business" | "Career";
  title: string;
  scene: SceneId;
  teacherRole: string; // who the teacher plays
  learnerRole: string;
  goal: string;
  keyPhrases: string[];
  minLevel: "A1" | "A2" | "B1" | "B2" | "C1";
  requires?: Feature;
}

const S = (s: Scenario) => s;

export const SCENARIOS: Scenario[] = [
  // DAILY LIFE
  S({ id: "meet-someone", category: "Daily life", title: "Meeting someone new", scene: "cafe", teacherRole: "a friendly stranger at a café", learnerRole: "yourself", goal: "Introduce yourself and keep a small-talk conversation going for 5 turns.", keyPhrases: ["Nice to meet you", "What do you do?", "How about you?"], minLevel: "A1" }),
  S({ id: "make-friends", category: "Daily life", title: "Making friends", scene: "cafe", teacherRole: "a new classmate", learnerRole: "yourself", goal: "Find two things you have in common and suggest meeting again.", keyPhrases: ["Me too!", "Do you want to…?", "Let's grab a coffee"], minLevel: "A2" }),
  S({ id: "shopping", category: "Daily life", title: "Shopping for clothes", scene: "shop", teacherRole: "a shop assistant", learnerRole: "a customer", goal: "Ask for a size, try something on and ask about a discount.", keyPhrases: ["Do you have this in…?", "Can I try it on?", "Is there a discount?"], minLevel: "A1" }),
  S({ id: "order-food", category: "Daily life", title: "Ordering food", scene: "restaurant", teacherRole: "a waiter", learnerRole: "a diner", goal: "Order a meal, ask about an ingredient, and ask for the bill.", keyPhrases: ["I'd like…", "Does it contain…?", "Could we get the bill, please?"], minLevel: "A1" }),
  S({ id: "neighbor", category: "Daily life", title: "Talking to a neighbour", scene: "street", teacherRole: "your neighbour", learnerRole: "yourself", goal: "Politely ask your neighbour to keep the noise down at night.", keyPhrases: ["Sorry to bother you", "Would you mind…?", "I really appreciate it"], minLevel: "A2" }),
  S({ id: "phone-call", category: "Daily life", title: "Phone call to book an appointment", scene: "studio", teacherRole: "a clinic receptionist", learnerRole: "a patient", goal: "Book, then reschedule, a doctor's appointment.", keyPhrases: ["I'd like to book…", "Is Thursday available?", "Could you repeat that?"], minLevel: "A2" }),
  // TRAVEL
  S({ id: "airport-checkin", category: "Travel", title: "Airport check-in", scene: "airport", teacherRole: "an airline check-in agent", learnerRole: "a passenger", goal: "Check in, ask for a window seat and ask about baggage allowance.", keyPhrases: ["I'd like to check in", "Window seat, please", "How many bags can I take?"], minLevel: "A2" }),
  S({ id: "immigration", category: "Travel", title: "Immigration desk", scene: "airport", teacherRole: "an immigration officer", learnerRole: "a traveller", goal: "Answer questions about the purpose and length of your trip clearly.", keyPhrases: ["I'm here on holiday", "I'm staying for…", "Here is my return ticket"], minLevel: "A2" }),
  S({ id: "hotel", category: "Travel", title: "Hotel check-in & a problem", scene: "hotel", teacherRole: "a hotel receptionist", learnerRole: "a guest", goal: "Check in, then report that the air-conditioning isn't working.", keyPhrases: ["I have a reservation under…", "There's a problem with…", "Could someone take a look?"], minLevel: "A2" }),
  S({ id: "taxi", category: "Travel", title: "Taking a taxi", scene: "street", teacherRole: "a taxi driver", learnerRole: "a passenger", goal: "Give the destination, ask the price and ask to stop somewhere.", keyPhrases: ["Could you take me to…?", "How much will it be?", "Could you stop here?"], minLevel: "A1" }),
  S({ id: "directions", category: "Travel", title: "Asking for directions", scene: "street", teacherRole: "a local", learnerRole: "a tourist", goal: "Find the nearest metro station and confirm the directions.", keyPhrases: ["Excuse me, how do I get to…?", "Is it far?", "So I go straight and then left?"], minLevel: "A1" }),
  // WORK
  S({ id: "office-smalltalk", category: "Work", title: "Office small talk", scene: "office", teacherRole: "a friendly colleague", learnerRole: "yourself", goal: "Chat about the weekend and a current project.", keyPhrases: ["How was your weekend?", "I've been working on…", "How's it going?"], minLevel: "A2" }),
  S({ id: "manager-update", category: "Work", title: "Update your manager", scene: "office", teacherRole: "your manager", learnerRole: "a team member", goal: "Give a status update, mention a blocker and ask for help.", keyPhrases: ["Quick update on…", "We're blocked by…", "Could you help me with…?"], minLevel: "B1", requires: "business_english" }),
  S({ id: "customer-support", category: "Work", title: "Customer support call", scene: "office", teacherRole: "an upset customer", learnerRole: "a support agent", goal: "Calm the customer, find the problem and promise a next step.", keyPhrases: ["I understand how frustrating…", "Let me check that for you", "I'll make sure…"], minLevel: "B1", requires: "business_english" }),
  S({ id: "sales-call", category: "Work", title: "Sales conversation", scene: "office", teacherRole: "a potential customer", learnerRole: "a salesperson", goal: "Ask about needs, explain one benefit and handle a price objection.", keyPhrases: ["What are you looking for?", "The main benefit is…", "I understand the budget concern"], minLevel: "B1", requires: "business_english" }),
  // BUSINESS
  S({ id: "client-meeting", category: "Business", title: "Client meeting", scene: "meeting", teacherRole: "a new client", learnerRole: "an account manager", goal: "Open the meeting, agree on an agenda and summarise next steps.", keyPhrases: ["Thanks for making the time", "Shall we start with…?", "To summarise…"], minLevel: "B1", requires: "premium_scenarios" }),
  S({ id: "product-presentation", category: "Business", title: "Product presentation", scene: "meeting", teacherRole: "an interested buyer who asks questions", learnerRole: "the presenter", goal: "Present a product in 3 points and answer two questions.", keyPhrases: ["Let me walk you through…", "The key advantage is…", "That's a great question"], minLevel: "B2", requires: "presentation_training" }),
  S({ id: "negotiation", category: "Business", title: "Negotiation", scene: "meeting", teacherRole: "a supplier", learnerRole: "a buyer", goal: "Negotiate a better price or delivery date without damaging the relationship.", keyPhrases: ["Is there any flexibility on…?", "If you could…, we could…", "Let's find a middle ground"], minLevel: "B2", requires: "premium_scenarios" }),
  S({ id: "sales-pitch", category: "Business", title: "60-second sales pitch", scene: "meeting", teacherRole: "an investor", learnerRole: "a founder", goal: "Pitch your idea in under a minute and handle one tough question.", keyPhrases: ["We help … to …", "Unlike …, we …", "Our next milestone is…"], minLevel: "B2", requires: "presentation_training" }),
  S({ id: "follow-up", category: "Business", title: "Follow-up call", scene: "office", teacherRole: "a client who went quiet", learnerRole: "an account manager", goal: "Re-open the conversation and agree on a decision date.", keyPhrases: ["I wanted to follow up on…", "Have you had a chance to…?", "Would it help if…?"], minLevel: "B1", requires: "premium_scenarios" }),
  S({ id: "complaint", category: "Business", title: "Handling a complaint", scene: "meeting", teacherRole: "an unhappy business client", learnerRole: "a service manager", goal: "Apologise professionally, explain what happened and offer a solution.", keyPhrases: ["I sincerely apologise for…", "What happened was…", "Here's what we'll do"], minLevel: "B2", requires: "premium_scenarios" }),
  // CAREER
  S({ id: "self-intro", category: "Career", title: "Self-introduction", scene: "interview", teacherRole: "an interviewer", learnerRole: "a candidate", goal: "Give a confident 45-second introduction.", keyPhrases: ["I'm currently working as…", "I specialise in…", "I'm excited about this role because…"], minLevel: "A2" }),
  S({ id: "job-interview", category: "Career", title: "Job interview", scene: "interview", teacherRole: "a hiring manager", learnerRole: "a candidate", goal: "Answer 4 common questions using clear examples.", keyPhrases: ["One example is when…", "As a result…", "What I learned was…"], minLevel: "B1", requires: "interview_practice" }),
  S({ id: "hr-interview", category: "Career", title: "HR interview", scene: "interview", teacherRole: "an HR recruiter", learnerRole: "a candidate", goal: "Discuss notice period, expectations and why you're changing jobs.", keyPhrases: ["My notice period is…", "I'm looking for…", "I'd like to grow in…"], minLevel: "B1", requires: "interview_practice" }),
  S({ id: "salary", category: "Career", title: "Salary discussion", scene: "interview", teacherRole: "an HR manager", learnerRole: "a candidate with an offer", goal: "Politely negotiate a higher salary using your value.", keyPhrases: ["Based on my experience…", "I was hoping for something closer to…", "Is there flexibility?"], minLevel: "B2", requires: "interview_practice" }),
  S({ id: "networking", category: "Career", title: "Professional networking", scene: "hotel", teacherRole: "a professional at a conference", learnerRole: "yourself", goal: "Introduce yourself, find common ground and exchange contacts.", keyPhrases: ["What brings you here?", "I'd love to stay in touch", "Are you on LinkedIn?"], minLevel: "B1", requires: "premium_scenarios" }),
];

export function getScenario(id: string | null | undefined): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
