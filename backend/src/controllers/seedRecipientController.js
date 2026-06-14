const SeedRecipient = require('../models/SeedRecipient');

const getSeeds = async (req, res) => {
  try {
    const seeds = await SeedRecipient.find().sort({ createdAt: -1 });
    return res.json({ seeds });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to retrieve seed recipients', error: error.message });
  }
};

const addSeed = async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Valid email is required' });
    }
    const seed = await SeedRecipient.create({ email: email.trim().toLowerCase(), name: (name || '').trim() });
    return res.status(201).json({ seed });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'This email is already a seed recipient' });
    }
    return res.status(400).json({ message: 'Unable to add seed recipient', error: error.message });
  }
};

const deleteSeed = async (req, res) => {
  try {
    const seed = await SeedRecipient.findByIdAndDelete(req.params.id);
    if (!seed) return res.status(404).json({ message: 'Seed recipient not found' });
    return res.json({ message: 'Seed recipient removed' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to delete seed recipient', error: error.message });
  }
};

const toggleSeed = async (req, res) => {
  try {
    const seed = await SeedRecipient.findById(req.params.id);
    if (!seed) return res.status(404).json({ message: 'Seed recipient not found' });
    seed.isActive = !seed.isActive;
    await seed.save();
    return res.json({ seed });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to toggle seed recipient', error: error.message });
  }
};

const bulkImportSeeds = async (req, res) => {
  try {
    const { emails } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: 'Emails array is required' });
    }
    let added = 0;
    let skipped = 0;
    for (const raw of emails) {
      const email = String(raw).trim().toLowerCase();
      if (!email.includes('@')) continue;
      try {
        await SeedRecipient.create({ email });
        added++;
      } catch {
        skipped++;
      }
    }
    return res.json({ message: `Added ${added} seed recipients (${skipped} skipped/duplicates)` });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to bulk import seeds', error: error.message });
  }
};

module.exports = { getSeeds, addSeed, deleteSeed, toggleSeed, bulkImportSeeds };
