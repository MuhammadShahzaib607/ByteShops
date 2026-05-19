import Store from "../models/Store.js";
import StoreView from "../models/StoreView.js";
import { sendRes } from "../utils/responseHandler.js";


export const trackStoreView = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { storeId } = req.body;

    if (!storeId) {
      return sendRes(res, 400, false, "Store ID is required");
    }

    const existingView = await StoreView.findOne({ storeId, userId });

    if (existingView) {
      return sendRes(res, 200, true, "View already recorded");
    }

    await StoreView.create({ storeId, userId });

    await Store.findByIdAndUpdate(storeId, {
      $inc: { totalViews: 1 },
    });

    return sendRes(res, 201, true, "View counted successfully");
  } catch (error) {
    console.error("Track Store View Error:", error);
    return sendRes(res, 500, false, "Internal server error");
  }
};

export const getStoreViewsAnalytics = async (req, res) => {
  try {
    const store = req.store; 
    const storeId = store._id;

    let days = parseInt(req.query.duration, 10);
    if (isNaN(days) || ![30, 90, 180, 365].includes(days)) {
      days = 30;
    }

    const now = new Date();
    const currentPeriodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000);

    const [currentPeriodCount, previousPeriodCount, dailyAggregates] = await Promise.all([
      StoreView.countDocuments({
        storeId,
        createdAt: { $gte: currentPeriodStart, $lte: now }
      }),
      StoreView.countDocuments({
        storeId,
        createdAt: { $gte: previousPeriodStart, $lt: currentPeriodStart }
      }),
      StoreView.aggregate([
        {
          $match: {
            storeId,
            createdAt: { $gte: currentPeriodStart, $lte: now }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            views: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    let pctChange = 0;
    if (previousPeriodCount > 0) {
      pctChange = Math.round(((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 100);
    } else if (currentPeriodCount > 0) {
      pctChange = 100;
    }

    let percentageChange = `${pctChange >= 0 ? '+' : ''}${pctChange}%`;

    let performanceStatus = "STEADY";
    if (pctChange > 5) {
      performanceStatus = "UP";
    } else if (pctChange < -5) {
      performanceStatus = "DOWN";
    }

    const graphData = dailyAggregates.map(item => ({
      date: item._id,
      views: item.views
    }));

    return sendRes(res, 200, true, "Analytics analytics fetched successfully", {
      lifetimeViews: store.totalViews || 0,
      periodTotalViews: currentPeriodCount,
      performanceStatus,
      percentageChange,
      graphData
    });

  } catch (error) {
    console.error("Store Views Analytics Error:", error);
    return sendRes(res, 500, false, "Internal server error");
  }
};