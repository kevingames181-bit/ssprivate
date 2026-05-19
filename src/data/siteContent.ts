export const headerContent = {
  logo: "SeaScope",
  navigation: [
    { title: "Home", link: "/", icon: "[icon:wave]" },
    { title: "Map", link: "/map", icon: "[icon:pin]" },
    { title: "Trends", link: "/trends", icon: "[icon:chart]" },
    { title: "Presentation", link: "/presentation", icon: "[icon:target]" },
    { title: "Company", link: "/company", icon: "[icon:building]" },
    { title: "FAQ", link: "/faq", icon: "[icon:info]" },
    { title: "Contact", link: "/contact", icon: "[icon:envelope]" }
  ],
  user_actions: [
    { title: "Login", link: "/login", icon: "[icon:user]" },
    { title: "Sign Up", link: "/signup", icon: "[icon:user-plus]" }
  ]
};

export const footerContent = {
  about: "SeaScope is Alaska's premier fishery intelligence platform, delivering real-time data visualization, predictive analytics, and comprehensive tide information. Trusted by marine biologists, commercial fishermen, and environmental researchers to make data-driven decisions in Alaska's dynamic marine ecosystem.",
  quick_links: [
    { title: "Home", link: "/" },
    { title: "Map", link: "/map" },
    { title: "Trends", link: "/trends" },
    { title: "Company", link: "/company" },
    { title: "FAQ", link: "/faq" },
    { title: "Contact", link: "/contact" }
  ],
  social_links: [
    { platform: "Twitter", link: "https://twitter.com/getseascope", icon: "twitter" },
    { platform: "LinkedIn", link: "https://linkedin.com/company/getseascope", icon: "linkedin" },
    { platform: "Instagram", link: "https://instagram.com/getseascope", icon: "instagram" }
  ],
  copyright: "© 2026 SeaScope. All rights reserved.",
  pyron_text: "Official Product of Pyron Company",
  pyron_link: "https://pyroncompany.com"
};

export const homeContent = {
  hero_section: {
    title: "Visualize Fishery Data Like Never Before",
    subtitle: "Interactive maps, tide info, and trends at your fingertips.",
    cta_buttons: [
      { title: "Explore Map", link: "/map", icon: "[icon:pin]" },
      { title: "View Trends", link: "/trends", icon: "[icon:chart]" }
    ],
    hero_image: "/images/common-logo.png"
  },
  features_section: [
    { 
      title: "Real-Time Maps", 
      description: "Visualize released and caught fish by species and quantity with interactive mapping technology.", 
      icon: "[icon:pin]" 
    },
    { 
      title: "Tide Data", 
      description: "Accurate high and low tide information for all Alaska coastal locations with sunrise and sunset times.", 
      icon: "[icon:wave]" 
    },
    { 
      title: "Analytics & Trends", 
      description: "Track patterns, peaks, and historical data with advanced visualization and predictive analytics.", 
      icon: "[icon:chart]" 
    }
  ]
};

export const companyContent = {
  title: "About Pyron Company",
  subtitle: "Building the future of data visualization and analytics",
  sections: [
    {
      title: "Our Mission",
      content: "Pyron Company is dedicated to transforming complex data into actionable insights through innovative technology solutions. We specialize in creating powerful, user-friendly platforms that empower organizations to make data-driven decisions."
    },
    {
      title: "What We Do",
      content: "We develop cutting-edge software solutions for data visualization, analytics, and real-time monitoring across various industries. Our flagship product, SeaScope, revolutionizes how fisheries and marine organizations interact with their data."
    },
    {
      title: "Our Technology",
      content: "Built with modern web technologies including React, TypeScript, and advanced mapping libraries, our platforms deliver enterprise-grade performance with consumer-grade simplicity. We leverage cloud infrastructure to ensure reliability and scalability."
    },
    {
      title: "Innovation First",
      content: "At Pyron Company, innovation drives everything we do. We continuously research and implement the latest technologies to stay ahead of industry trends and deliver exceptional value to our clients."
    }
  ],
  stats: [
    { value: "2025", label: "Founded" },
    { value: "99.9%", label: "Uptime" },
    { value: "24/7", label: "Support" }
  ],
  contact: {
    email: "info@pyroncompany.com",
    website: "https://pyroncompany.com",
    address: "Remote"
  }
};

export const faqContent = {
  title: "Frequently Asked Questions",
  faqs: [
    { 
      question: "What data does SeaScope provide?", 
      answer: "SeaScope provides real-time fish releases, catches, tide info, and analytics from Alaska Department of Fish & Game (ADF&G).", 
      icon: "[icon:info]" 
    },
    { 
      question: "How often is the data updated?", 
      answer: "Data is updated daily based on ADF&G releases and real-time tide information.", 
      icon: "[icon:calendar]" 
    },
    { 
      question: "Can I filter by species?", 
      answer: "Yes, the map and trends pages include comprehensive species, hatchery, and date filters.", 
      icon: "[icon:fish]" 
    },
    { 
      question: "What species are tracked?", 
      answer: "We track all major Alaska salmon species: Chinook, Sockeye, Coho, Pink, and Chum.", 
      icon: "[icon:fish]" 
    },
    { 
      question: "How do I read the map?", 
      answer: "Dots represent fish release locations. Dot size indicates quantity, color indicates species. Click any dot for detailed information.", 
      icon: "[icon:pin]" 
    },
    { 
      question: "Is there a mobile app?", 
      answer: "Currently SeaScope is web-based and fully responsive. A native mobile app is in development.", 
      icon: "[icon:info]" 
    },
    { 
      question: "How can I contact support?", 
      answer: "Use the Contact page or email support@getseascope.com for assistance.", 
      icon: "[icon:envelope]" 
    }
  ]
};

export const contactContent = {
  title: "Contact Us",
  description: "Reach out with questions, feedback, or partnership inquiries.",
  form_fields: [
    { label: "Name", type: "text", placeholder: "Your name" },
    { label: "Email", type: "email", placeholder: "your.email@example.com" },
    { label: "Subject", type: "text", placeholder: "What is this regarding?" },
    { label: "Message", type: "textarea", placeholder: "Your message..." }
  ],
  submit_button: { title: "Send Message", icon: "[icon:send]" },
  contact_info: {
    email: "support@getseascope.com",
    company: "Pyron Company",
    website: "https://pyroncompany.com"
  }
};
