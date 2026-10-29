import { User, Tier } from '../models/index.js';

export async function ensureDefaultTiers() {
  const platinum = await Tier.findById('tier-platinum');
  if (!platinum) {
    await Tier.create({
      _id: 'tier-platinum',
      name: 'Platinum Elite',
      slug: 'platinum-elite',
      price: 999,
      interval: 'yearly',
      description: 'The highest echelon of membership for visionaries and enterprise patrons.',
      perks: [
        'All Gold VIP privileges with no restrictions',
        'Dedicated personal account executive',
        'Sponsorship placement at annual symposium',
        'Unlimited VIP guest allowances',
        'Custom engraved physical NFC membership talisman'
      ],
      isActive: true,
      maxMembers: 50
    });
    console.log('✅ Restored default tier-platinum record.');
  }
}

export async function seedDatabase() {
  await ensureDefaultTiers();

  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) {
    console.log('📦 Database already has user records.');
    return;
  }

  // Seed all four default membership tiers for the registration flow
  const tierCount = await Tier.countDocuments();
  if (tierCount === 0) {
    const tiers = [
      {
        _id: 'tier-bronze',
        name: 'Bronze Explorer',
        slug: 'bronze-explorer',
        price: 29,
        interval: 'monthly',
        description: 'Essential access for community newcomers and casual event attendees.',
        perks: [
          'Access to monthly community meetups',
          'Digital membership pass in Google Wallet',
          'Standard member directory listing',
          'Community discussion board access'
        ],
        isActive: true,
        maxMembers: 500
      },
      {
        _id: 'tier-silver',
        name: 'Silver Patron',
        slug: 'silver-patron',
        price: 79,
        interval: 'monthly',
        description: 'Enhanced tier for dedicated members desiring premium workshops and networking.',
        perks: [
          'All Bronze tier benefits',
          'Priority RSVP to limited-capacity workshops',
          'Exclusive quarterly masterclasses',
          '2 guest passes per calendar quarter',
          '10% discount on conference tickets'
        ],
        isActive: true,
        maxMembers: 300
      },
      {
        _id: 'tier-gold',
        name: 'Gold VIP',
        slug: 'gold-vip',
        price: 149,
        interval: 'monthly',
        description: 'Flagship VIP access with private lounge entry and executive dinners.',
        perks: [
          'All Silver tier benefits',
          'Access to Private VIP Member Lounge',
          'Guaranteed front-row seating at keynote events',
          'Direct messaging with community leaders',
          'Invitation to closed-door Executive Dinners',
          'Automated concierge booking'
        ],
        isActive: true,
        maxMembers: 150
      },
      {
        _id: 'tier-platinum',
        name: 'Platinum Elite',
        slug: 'platinum-elite',
        price: 999,
        interval: 'yearly',
        description: 'The highest echelon of membership for visionaries and enterprise patrons.',
        perks: [
          'All Gold VIP privileges with no restrictions',
          'Dedicated personal account executive',
          'Sponsorship placement at annual symposium',
          'Unlimited VIP guest allowances',
          'Custom engraved physical NFC membership talisman'
        ],
        isActive: true,
        maxMembers: 50
      }
    ];

    for (const t of tiers) {
      await Tier.create(t);
    }
    console.log('✅ Default membership tiers seeded.');
  }

  console.log('🌱 Database is clean and ready for real user registrations.');
}
