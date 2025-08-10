import styles from './Pricing.module.scss';

interface PricingTier {
  name: string;
  price: string;
  features: string[];
  isPopular?: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    features: [
      'Convert up to 10 pages per month',
      'Basic voice selection',
      'Standard quality audio',
      'Email support'
    ]
  },
  {
    name: 'Pro',
    price: '$9.99',
    features: [
      'Convert up to 100 pages per month',
      'Access to all voices',
      'High quality audio',
      'Priority email support',
      'No watermark',
      'Custom voice settings'
    ],
    isPopular: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    features: [
      'Unlimited page conversions',
      'Custom voice creation',
      'Ultra-high quality audio',
      '24/7 priority support',
      'API access',
      'Custom integration',
      'Dedicated account manager'
    ]
  }
];

export function Pricing() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Simple, Transparent Pricing</h1>
        <p>Choose the plan that's right for you</p>
      </header>

      <div className={styles.pricingGrid}>
        {pricingTiers.map((tier) => (
          <div 
            key={tier.name} 
            className={`${styles.pricingCard} ${tier.isPopular ? styles.popular : ''}`}
          >
            {tier.isPopular && (
              <div className={styles.popularBadge}>Most Popular</div>
            )}
            <h2 className={styles.tierName}>{tier.name}</h2>
            <div className={styles.price}>
              <span className={styles.amount}>{tier.price}</span>
              {tier.price !== 'Custom' && <span className={styles.period}>/month</span>}
            </div>
            <ul className={styles.features}>
              {tier.features.map((feature, index) => (
                <li key={index} className={styles.feature}>
                  <svg 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    className={styles.checkIcon}
                  >
                    <path 
                      d="M20 6L9 17l-5-5" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <button 
              className={`${styles.button} ${tier.isPopular ? styles.primaryButton : ''}`}
            >
              {tier.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
            </button>
          </div>
        ))}
      </div>

      <div className={styles.guarantee}>
        <svg viewBox="0 0 24 24" fill="currentColor" className={styles.shieldIcon}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <p>30-day money-back guarantee • Cancel anytime • Secure payment</p>
      </div>
    </div>
  );
} 