export type SupportedLocale = 'th' | 'en' | 'zh' | 'ja';

export interface TranslationSchema {
  common: {
    appName: string;
    search: string;
    filter: string;
    save: string;
    cancel: string;
    confirm: string;
    loading: string;
    scheduleViewing: string;
    viewDetails: string;
    payWithQr: string;
    schedule: string;
    signOut: string;
  };
  roles: {
    guest: string;
    tenant: string;
    owner: string;
    agent: string;
    admin: string;
    services: string;
    guestSubtitle: string;
    tenantSubtitle: string;
    ownerSubtitle: string;
    agentSubtitle: string;
    adminSubtitle: string;
    servicesSubtitle: string;
  };
  mobile: {
    tabs: {
      home: string;
      search: string;
      living: string;
      bills: string;
      dashboard: string;
      listings: string;
      listingRoom: string;
      listingLead: string;
      contact: string;
      calendar: string;
      income: string;
      deals: string;
      tickets: string;
      services: string;
      menu: string;
    };
    screens: {
      home: string;
      discover: string;
      living: string;
      bills: string;
      dashboard: string;
      listings: string;
      listingRoom: string;
      listingLead: string;
      contact: string;
      calendar: string;
      income: string;
      deals: string;
      tickets: string;
      services: string;
    };
    notifications: {
      title: string;
      activity: string;
      messages: string;
    };
    profile: {
      hubSubtitle: string;
      switchRole: string;
      navigation: string;
      settings: string;
      myRental: string;
      billsPayments: string;
      maintenanceServices: string;
      accountSettings: string;
    };
    drawerMenu: {
      sectionTitle: string;
      favorites: string;
      viewings: string;
      help: string;
      faq: string;
      contactSupport: string;
      contract: string;
      reportIssue: string;
      documents: string;
      leaseDoc: string;
      receipts: string;
      tenants: string;
      ownerContracts: string;
      reports: string;
      incomeReport: string;
      occupancy: string;
      listing: string;
      listingRoom: string;
      listingLead: string;
      crm: string;
      contact: string;
      calendar: string;
      commission: string;
      agentContracts: string;
      users: string;
      tickets: string;
      system: string;
      audit: string;
      opsSettings: string;
    };
    settings: {
      darkMode: string;
      language: string;
      languageNames: {
        th: string;
        en: string;
        zh: string;
        ja: string;
      };
    };
    account: {
      title: string;
      personalInfo: string;
      fullName: string;
      email: string;
      phone: string;
      editProfile: string;
      editProfileHint: string;
      profileSaved: string;
      security: string;
      changePassword: string;
      changePasswordHint: string;
      password: {
        current: string;
        new: string;
        confirm: string;
        submit: string;
        subtitle: string;
        requirements: string;
        required: string;
        tooShort: string;
        mismatch: string;
        updated: string;
      };
      notifications: string;
      pushNotifications: string;
      emailNotifications: string;
    };
  };
  tenant: {
    myRental: string;
    digitalContract: string;
    billsAndPayments: string;
    reportIssue: string;
    cleaningRequest: string;
  };
  owner: {
    myListings: string;
    createNewListing: string;
    rentalIncome: string;
    coAgentSettings: string;
    requestMaintenance: string;
  };
  agent: {
    coBrokeCatalog: string;
    viewingSchedule: string;
    myDeals: string;
    commissionSummary: string;
  };
  services: {
    title: string;
    subtitle: string;
    activeTickets: string;
    viewing: string;
    cleaning: string;
    repair: string;
    inspection: string;
    support: string;
    myTickets: string;
    emergency: string;
    moveIn: string;
    maintenance: string;
    status: {
      requested: string;
      assigned: string;
      in_progress: string;
      completed: string;
      cancelled: string;
    };
  };
}
