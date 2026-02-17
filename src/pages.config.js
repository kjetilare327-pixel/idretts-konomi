/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AuditLog from './pages/AuditLog';
import BankReconciliation from './pages/BankReconciliation';
import Budget from './pages/Budget';
import Communications from './pages/Communications';
import Dashboard from './pages/Dashboard';
import EventManagement from './pages/EventManagement';
import MemberManagement from './pages/MemberManagement';
import Onboarding from './pages/Onboarding';
import PaymentPortal from './pages/PaymentPortal';
import Players from './pages/Players';
import ReferralProgram from './pages/ReferralProgram';
import Reports from './pages/Reports';
import SettingsPage from './pages/SettingsPage';
import Transactions from './pages/Transactions';
import VolunteerManagement from './pages/VolunteerManagement';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AuditLog": AuditLog,
    "BankReconciliation": BankReconciliation,
    "Budget": Budget,
    "Communications": Communications,
    "Dashboard": Dashboard,
    "EventManagement": EventManagement,
    "MemberManagement": MemberManagement,
    "Onboarding": Onboarding,
    "PaymentPortal": PaymentPortal,
    "Players": Players,
    "ReferralProgram": ReferralProgram,
    "Reports": Reports,
    "SettingsPage": SettingsPage,
    "Transactions": Transactions,
    "VolunteerManagement": VolunteerManagement,
}

export const pagesConfig = {
    mainPage: "Onboarding",
    Pages: PAGES,
    Layout: __Layout,
};