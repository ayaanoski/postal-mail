const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const Tracking = require('../models/Tracking');
const DeliveryEvent = require('../models/DeliveryEvent');

/**
 * GET /api/campaigns/:id/stats
 * Aggregates delivery, open, and click stats for a single campaign.
 */
const getCampaignStats = async (req, res) => {
  try {
    const campaignId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ message: 'Invalid campaign ID format' });
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    const totalRecipients = campaign.recipients.length;
    const sentCount = campaign.recipients.filter((r) => r.status === 'sent').length;
    const failedCount = campaign.recipients.filter((r) => r.status === 'failed' || r.status === 'bounced').length;

    // Aggregate open/click counts
    const totalOpens = await Tracking.countDocuments({ campaignId, type: 'open' });
    const uniqueOpensList = await Tracking.distinct('recipientId', { campaignId, type: 'open' });
    const uniqueOpens = uniqueOpensList.length;

    const totalClicks = await Tracking.countDocuments({ campaignId, type: 'click' });
    const uniqueClicksList = await Tracking.distinct('recipientId', { campaignId, type: 'click' });
    const uniqueClicks = uniqueClicksList.length;

    // Group clicks by URL
    const clickUrlStats = await Tracking.aggregate([
      { $match: { campaignId: new mongoose.Types.ObjectId(campaignId), type: 'click' } },
      { $group: { _id: '$url', total: { $sum: 1 }, unique: { $addToSet: '$recipientId' } } },
      { $project: { url: '$_id', total: 1, unique: { $size: '$unique' }, _id: 0 } },
      { $sort: { total: -1 } }
    ]);

    // Fetch recent events for the timeline view
    const recentEvents = await Tracking.find({ campaignId })
      .sort({ createdAt: -1 })
      .limit(50);

    const recipientsMap = new Map(campaign.recipients.map((r) => [r._id.toString(), r.email]));
    const mappedEvents = recentEvents.map((evt) => ({
      id: evt._id,
      type: evt.type,
      url: evt.url,
      timestamp: evt.createdAt,
      recipient: recipientsMap.get(evt.recipientId.toString()) || 'Unknown recipient',
      metadata: evt.metadata
    }));

    // Fetch delivery failure reasons
    const failedDeliveryEvents = await DeliveryEvent.find({
      campaignId,
      status: { $in: ['bounced', 'expired', 'failed'] }
    })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    const failedRecipients = failedDeliveryEvents.map((evt) => {
      const recipient = campaign.recipients.find(
        (r) => r._id.toString() === (evt.recipientId?.toString() || '')
      );
      return {
        email: evt.recipient || recipient?.email || 'Unknown',
        status: evt.status,
        reason: evt.diagnostic || 'No details provided',
        timestamp: evt.timestamp
      };
    });

    const openRate = totalRecipients > 0 ? ((uniqueOpens / totalRecipients) * 100).toFixed(1) + '%' : '0.0%';
    const clickRate = totalRecipients > 0 ? ((uniqueClicks / totalRecipients) * 100).toFixed(1) + '%' : '0.0%';
    const ctr = uniqueOpens > 0 ? ((uniqueClicks / uniqueOpens) * 100).toFixed(1) + '%' : '0.0%';

    return res.json({
      campaign: {
        id: campaign._id,
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
        createdAt: campaign.createdAt
      },
      stats: {
        totalRecipients,
        sent: sentCount,
        failed: failedCount,
        totalOpens,
        uniqueOpens,
        openRate,
        totalClicks,
        uniqueClicks,
        clickRate,
        clickThroughRate: ctr,
        urlStats: clickUrlStats,
        events: mappedEvents,
        failedRecipients
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to retrieve campaign stats',
      error: error.message
    });
  }
};

/**
 * GET /api/stats/overview
 * Aggregates global system-wide metrics.
 */
const getOverviewStats = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== 'Admin') {
      filter.userId = req.user.id;
    }

    const totalCampaigns = await Campaign.countDocuments(filter);
    
    // Sum stats across campaigns
    const campaigns = await Campaign.find(filter, '_id recipients');
    let totalSent = 0;
    let totalFailed = 0;

    campaigns.forEach((c) => {
      totalSent += c.recipients.filter((r) => r.status === 'sent').length;
      totalFailed += c.recipients.filter((r) => r.status === 'failed').length;
    });

    const campaignIds = campaigns.map((c) => c._id);
    const trackingFilter = req.user.role === 'Admin' ? {} : { campaignId: { $in: campaignIds } };

    const totalOpens = await Tracking.countDocuments({ ...trackingFilter, type: 'open' });
    const totalClicks = await Tracking.countDocuments({ ...trackingFilter, type: 'click' });
    const totalUnsubscribes = await Tracking.countDocuments({ ...trackingFilter, type: 'unsubscribe' });

    // Calculate unique opens/clicks per campaign to find average rates
    const uniqueOpens = await Tracking.aggregate([
      { $match: { ...trackingFilter, type: 'open' } },
      { $group: { _id: { campaignId: '$campaignId', recipientId: '$recipientId' } } },
      { $group: { _id: '$_id.campaignId', count: { $sum: 1 } } }
    ]);
    const totalUniqueOpens = uniqueOpens.reduce((acc, curr) => acc + curr.count, 0);

    const uniqueClicks = await Tracking.aggregate([
      { $match: { ...trackingFilter, type: 'click' } },
      { $group: { _id: { campaignId: '$campaignId', recipientId: '$recipientId' } } },
      { $group: { _id: '$_id.campaignId', count: { $sum: 1 } } }
    ]);
    const totalUniqueClicks = uniqueClicks.reduce((acc, curr) => acc + curr.count, 0);

    const averageOpenRate = totalSent > 0 ? ((totalUniqueOpens / totalSent) * 100).toFixed(1) + '%' : '0.0%';
    const averageClickRate = totalSent > 0 ? ((totalUniqueClicks / totalSent) * 100).toFixed(1) + '%' : '0.0%';
    const averageUnsubscribeRate = totalSent > 0 ? ((totalUnsubscribes / totalSent) * 100).toFixed(1) + '%' : '0.0%';

    return res.json({
      totalCampaigns,
      totalSent,
      totalFailed,
      totalOpens,
      totalClicks,
      totalUniqueOpens,
      totalUniqueClicks,
      totalUnsubscribes,
      averageOpenRate,
      averageClickRate,
      averageUnsubscribeRate
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to retrieve overview stats',
      error: error.message
    });
  }
};

/**
 * DELETE /api/tracking/:id
 * Deletes a single tracking event (open or click) from the database.
 */
const deleteTrackingEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid tracking event ID format' });
    }

    const trackingEvent = await Tracking.findByIdAndDelete(id);
    if (!trackingEvent) {
      return res.status(404).json({ message: 'Tracking event not found' });
    }

    return res.json({ message: 'Tracking event deleted successfully', id });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to delete tracking event',
      error: error.message
    });
  }
};

module.exports = {
  getCampaignStats,
  getOverviewStats,
  deleteTrackingEvent
};
