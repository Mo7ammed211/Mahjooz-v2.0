// ═══════════════════════════════════════════════════════════════════
//  محجوز — Advanced Reporting & Analytics System
//  نظام التقارير والتحليلات المالية المتقدمة الدوري وحساب الأقسام
// ═══════════════════════════════════════════════════════════════════
'use strict';

// دالة مساعدة لحساب رقم الأسبوع ISO
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ─── Reports Manager Class ────────────────────────────────────────
class ReportsManager {
  constructor() {
    this.reports = [];
    this.charts = {};
  }

  // ─── جمع وتفصيل بيانات المبيعات الدوري والفرز حسب القسم ────────────
  async getSalesReport(startDate, endDate) {
    try {
      // 1. التصفية المباشرة من الذاكرة لسرعة الاستجابة وتفادي أخطاء الفهرسة
      // 1. تصفية من الذاكرة للطلبات النشطة
      let activeList = [];
      if (AppData.orders && AppData.orders.length > 0) {
        activeList = AppData.orders.filter(o => {
          const d = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : null;
          if (!d) return false;
          const ms = d.getTime();
          return ms >= startMs && ms <= endMs;
        });
      }

      // 2. تصفية من الذاكرة للطلبات مؤرشفة (المكتملة والملغية)
      let archivedList = [];
      if (State._archivedOrdersLoaded && AppData.archivedOrders && AppData.archivedOrders.length > 0) {
        archivedList = AppData.archivedOrders.filter(o => {
          const d = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : null;
          if (!d) return false;
          const ms = d.getTime();
          return ms >= startMs && ms <= endMs;
        });
      } else {
        // إذا لم تكن محملة، نجلبها من Firestore للنطاق الزمني
        try {
          const snap = await db.collection('archivedOrders')
            .where('createdAt', '>=', startDate)
            .where('createdAt', '<=', endDate)
            .get();
          archivedList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch(e) {
          console.warn("Firestore archivedOrders query failed", e);
        }
      }

      ordersList = [...activeList, ...archivedList];
      
      // 3. تصفية بديلة من السيرفر كاحتياطي في حال خلو الذاكرة بالكامل
      if (ordersList.length === 0) {
        try {
          const snap = await db.collection('orders')
            .where('createdAt', '>=', startDate)
            .where('createdAt', '<=', endDate)
            .get();
          const activeDb = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          const snapArch = await db.collection('archivedOrders')
            .where('createdAt', '>=', startDate)
            .where('createdAt', '<=', endDate)
            .get();
          const archDb = snapArch.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          ordersList = [...activeDb, ...archDb];
        } catch(e) {
          console.warn("Firestore query fallback failed", e);
          ordersList = [];
        }
      }

      const salesData = {
        totalOrders: ordersList.length,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        avgOrderValue: 0,
        ordersByStatus: {},
        paymentStats: {},
        departments: {
          bookings: { name: '📅 الحجوزات والخدمات', revenue: 0, cost: 0, profit: 0, count: 0 },
          stores: { name: '🏪 المتاجر التقليدية', revenue: 0, cost: 0, profit: 0, count: 0 },
          professions: { name: '🛠️ المهن والمهنيين', revenue: 0, cost: 0, profit: 0, count: 0 },
          rentals: { name: '🏷️ التأجير العقاري/المنتجات', revenue: 0, cost: 0, profit: 0, count: 0 },
          digital: { name: '⚡ الشحن والمنتجات الرقمية', revenue: 0, cost: 0, profit: 0, count: 0 }
        },
        timeSeries: {
          daily: {},
          weekly: {},
          monthly: {},
          yearly: {}
        },
        rawOrders: ordersList
      };

      ordersList.forEach(order => {
        const d = order.createdAt ? (order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt)) : null;
        if (!d) return;

        // الإيرادات والتكاليف
        const rev = Number(order.total) || Number(order.servicePrice) || 0;
        const cost = Number(order.serviceCost) || 0;
        const profit = rev - cost;

        salesData.totalRevenue += rev;
        salesData.totalCost += cost;
        salesData.totalProfit += profit;

        // فرز الحالات
        const status = order.status || 'pending';
        salesData.ordersByStatus[status] = (salesData.ordersByStatus[status] || 0) + 1;

        // طرق الدفع
        const payMethod = order.paymentMethod || 'cod';
        salesData.paymentStats[payMethod] = (salesData.paymentStats[payMethod] || 0) + rev;

        // تصنيف الأقسام التشغيلية
        let dept = 'bookings';
        if (order.type === 'store_order') {
          const hasDigital = order.items && order.items.some(i => i.productType === 'digital');
          dept = hasDigital ? 'digital' : 'stores';
        } else if (order.type === 'profession_order' || order.isProfession) {
          dept = 'professions';
        } else if (order.type === 'rental_order') {
          dept = 'rentals';
        } else if (order.type === 'booking_order') {
          dept = 'bookings';
        } else {
          // تصنيف احتياطي بناءً على الأيقونات والأدلة
          if (order.svcIcon === '⚡') dept = 'digital';
          else if (order.svcIcon === '🏪') dept = 'stores';
          else if (order.svcIcon === '💼') dept = 'professions';
          else if (order.svcIcon === '🏚️') dept = 'rentals';
        }

        salesData.departments[dept].revenue += rev;
        salesData.departments[dept].cost += cost;
        salesData.departments[dept].profit += profit;
        salesData.departments[dept].count += 1;

        // مفاتيح التجميع الدوري
        const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const yearKey = `${d.getFullYear()}`;
        const weekKey = getWeekNumber(d);

        // يومي
        if (!salesData.timeSeries.daily[dayKey]) salesData.timeSeries.daily[dayKey] = { revenue: 0, cost: 0, profit: 0, count: 0 };
        salesData.timeSeries.daily[dayKey].revenue += rev;
        salesData.timeSeries.daily[dayKey].cost += cost;
        salesData.timeSeries.daily[dayKey].profit += profit;
        salesData.timeSeries.daily[dayKey].count += 1;

        // أسبوعي
        if (!salesData.timeSeries.weekly[weekKey]) salesData.timeSeries.weekly[weekKey] = { revenue: 0, cost: 0, profit: 0, count: 0 };
        salesData.timeSeries.weekly[weekKey].revenue += rev;
        salesData.timeSeries.weekly[weekKey].cost += cost;
        salesData.timeSeries.weekly[weekKey].profit += profit;
        salesData.timeSeries.weekly[weekKey].count += 1;

        // شهري
        if (!salesData.timeSeries.monthly[monthKey]) salesData.timeSeries.monthly[monthKey] = { revenue: 0, cost: 0, profit: 0, count: 0 };
        salesData.timeSeries.monthly[monthKey].revenue += rev;
        salesData.timeSeries.monthly[monthKey].cost += cost;
        salesData.timeSeries.monthly[monthKey].profit += profit;
        salesData.timeSeries.monthly[monthKey].count += 1;

        // سنوي
        if (!salesData.timeSeries.yearly[yearKey]) salesData.timeSeries.yearly[yearKey] = { revenue: 0, cost: 0, profit: 0, count: 0 };
        salesData.timeSeries.yearly[yearKey].revenue += rev;
        salesData.timeSeries.yearly[yearKey].cost += cost;
        salesData.timeSeries.yearly[yearKey].profit += profit;
        salesData.timeSeries.yearly[yearKey].count += 1;
      });

      salesData.avgOrderValue = salesData.totalOrders > 0 ? Math.round(salesData.totalRevenue / salesData.totalOrders) : 0;
      return salesData;
    } catch (error) {
      console.error('Error generating sales report:', error);
      return {};
    }
  }

  // ─── تقرير الأداء حسب الفئة ──────────────────────────────────────
  async getCategoryPerformance() {
    try {
      const categories = await fsGetAll('categories');
      const performance = [];

      for (const cat of categories) {
        const activeOrders = await fsQuery('orders', 'category', '==', cat.id);
        const archivedOrders = await fsQuery('archivedOrders', 'category', '==', cat.id);
        const orders = [...activeOrders, ...archivedOrders];
        const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || o.total || 0), 0);
        const avgRating = orders.length > 0 
          ? (orders.reduce((sum, o) => sum + (o.rating || 0), 0) / orders.length).toFixed(1)
          : 0;

        performance.push({
          categoryId: cat.id,
          categoryName: cat.name,
          orderCount: orders.length,
          totalRevenue,
          avgRating,
          totalComments: orders.reduce((sum, o) => sum + (o.comments?.length || 0), 0)
        });
      }

      return performance.sort((a, b) => b.totalRevenue - a.totalRevenue);
    } catch (error) {
      console.error('Error getting category performance:', error);
      return [];
    }
  }

  // ─── تقرير أداء البائعين والمزودين ───────────────────────────────
  async getVendorPerformance() {
    try {
      const vendors = await fsQuery('users', 'role', '==', 'vendor');
      const providers = await fsQuery('users', 'role', '==', 'provider');
      const allVendors = [...vendors, ...providers];
      const vendorData = [];

      for (const vendor of allVendors) {
        const activeOrders = await fsQuery('orders', 'providerUid', '==', vendor.id || vendor.uid);
        const archivedOrders = await fsQuery('archivedOrders', 'providerUid', '==', vendor.id || vendor.uid);
        const orders = [...activeOrders, ...archivedOrders];
        const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        const completedOrders = orders.filter(o => o.status === 'completed').length;
        const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
        const avgRating = orders.length > 0 
          ? (orders.reduce((sum, o) => sum + (o.rating || 0), 0) / orders.length).toFixed(1)
          : 0;

        // حساب متوسط وقت الاستجابة
        const respondedOrders = orders.filter(o => o.responseTimeSecs != null && o.responseTimeSecs > 0);
        const avgResponseSecs = respondedOrders.length > 0
          ? Math.round(respondedOrders.reduce((s, o) => s + o.responseTimeSecs, 0) / respondedOrders.length)
          : null;
        const acceptedOrders  = orders.filter(o => o.responseAction === 'accepted').length;
        const rejectedOrders  = orders.filter(o => o.responseAction === 'rejected').length;
        const acceptRate      = respondedOrders.length > 0
          ? ((acceptedOrders / respondedOrders.length) * 100).toFixed(0)
          : null;

        vendorData.push({
          vendorId: vendor.id || vendor.uid,
          vendorName: vendor.displayName || vendor.name || 'مقدم خدمة مجهول',
          totalOrders: orders.length,
          completedOrders,
          cancelledOrders,
          completionRate: orders.length > 0 ? ((completedOrders / orders.length) * 100).toFixed(0) : 0,
          totalRevenue,
          avgRating,
          avgResponseSecs,
          acceptedOrders,
          rejectedOrders,
          acceptRate,
          joinDate: vendor.createdAt?.toDate ? vendor.createdAt.toDate().toLocaleDateString('ar-YE') : '-'
        });
      }

      return vendorData.sort((a, b) => b.totalRevenue - a.totalRevenue);
    } catch (error) {
      console.error('Error getting vendor performance:', error);
      return [];
    }
  }

  // ─── تقرير أداء العملاء ──────────────────────────────────────────
  async getCustomerAnalytics() {
    try {
      const customers = await fsQuery('users', 'role', '==', 'customer');
      const analytics = {
        totalCustomers: customers.length,
        activeCustomers: 0,
        newCustomers: 0,
        repeatCustomers: 0,
        totalSpent: 0,
        avgOrderValue: 0,
        topCustomers: [],
        customerSegmentation: {
          highValue: 0,
          mediumValue: 0,
          lowValue: 0
        }
      };

      for (const customer of customers) {
        const activeOrders = await fsQuery('orders', 'customerId', '==', customer.id || customer.uid);
        const archivedOrders = await fsQuery('archivedOrders', 'customerId', '==', customer.id || customer.uid);
        const orders = [...activeOrders, ...archivedOrders];
        const totalSpent = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        const lastOrderDate = orders.length > 0 
          ? Math.max(...orders.map(o => {
              const d = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : null;
              return d ? d.getTime() : 0;
            }))
          : 0;

        if (Date.now() - lastOrderDate < 30 * 24 * 60 * 60 * 1000) {
          analytics.activeCustomers++;
        }

        if (orders.length > 1) {
          analytics.repeatCustomers++;
        }

        if (totalSpent > 5000) {
          analytics.customerSegmentation.highValue++;
        } else if (totalSpent > 1000) {
          analytics.customerSegmentation.mediumValue++;
        } else if (totalSpent > 0) {
          analytics.customerSegmentation.lowValue++;
        }

        analytics.totalSpent += totalSpent;

        if (orders.length > 0) {
          analytics.topCustomers.push({
            customerId: customer.id || customer.uid,
            customerName: customer.name || customer.displayName || 'عميل مجهول',
            orderCount: orders.length,
            totalSpent,
            lastOrderDate: lastOrderDate > 0 ? new Date(lastOrderDate).toLocaleDateString('ar-YE') : '-'
          });
        }
      }

      analytics.avgOrderValue = customers.length > 0 
        ? (analytics.totalSpent / customers.length).toFixed(0)
        : 0;
      
      analytics.topCustomers.sort((a, b) => b.totalSpent - a.totalSpent);
      return analytics;
    } catch (error) {
      console.error('Error getting customer analytics:', error);
      return {};
    }
  }

  // ─── تقرير المحفظة والمعاملات ───────────────────────────────────
  async getWalletReport() {
    try {
      const transactions = await fsGetAll('transactions');
      const wallets = await fsGetAll('wallets');

      const report = {
        totalBalances: 0,
        totalCredits: 0,
        totalDebits: 0,
        activeWallets: wallets.filter(w => w.balance > 0).length,
        totalWallets: wallets.length,
        topBalances: [],
        transactionsByType: {},
        dailyTransactions: {}
      };

      wallets.forEach(wallet => {
        report.totalBalances += wallet.balance || 0;
        report.topBalances.push({
          userId: wallet.uid,
          balance: wallet.balance || 0
        });
      });

      report.topBalances.sort((a, b) => b.balance - a.balance);

      transactions.forEach(tx => {
        report.totalCredits += tx.type === 'credit' ? (tx.amount || 0) : 0;
        report.totalDebits += tx.type === 'debit' ? (tx.amount || 0) : 0;
        report.transactionsByType[tx.type] = (report.transactionsByType[tx.type] || 0) + 1;
        
        const d = tx.createdAt ? (tx.createdAt.toDate ? tx.createdAt.toDate() : new Date(tx.createdAt)) : null;
        if (d) {
          const date = d.toISOString().split('T')[0];
          report.dailyTransactions[date] = (report.dailyTransactions[date] || 0) + 1;
        }
      });

      return report;
    } catch (error) {
      console.error('Error generating wallet report:', error);
      return {};
    }
  }

  // ─── تقرير التقييمات والآراء ──────────────────────────────────────
  async getRatingsReport() {
    try {
      const ratings = await fsGetAll('ratings');

      const report = {
        totalRatings: ratings.length,
        averageRating: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        topRatedServices: [],
        recentReviews: []
      };

      let totalStars = 0;
      ratings.forEach(rating => {
        totalStars += rating.stars || 0;
        const stars = Math.round(rating.stars || 0);
        if (stars >= 1 && stars <= 5) {
          report.ratingDistribution[stars]++;
        }
      });

      report.averageRating = ratings.length > 0 
        ? (totalStars / ratings.length).toFixed(2)
        : 0;

      report.recentReviews = ratings
        .sort((a, b) => {
          const ad = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
          const bd = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
          return bd - ad;
        })
        .slice(0, 20)
        .map(r => {
          const d = r.createdAt ? (r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt)) : null;
          return {
            serviceId: r.serviceId,
            stars: r.stars,
            comment: r.comment || '—',
            date: d ? d.toLocaleDateString('ar-YE') : '-'
          };
        });

      return report;
    } catch (error) {
      console.error('Error generating ratings report:', error);
      return {};
    }
  }

  // ─── تقرير دعم العملاء والتذاكر ──────────────────────────────────
  async getSupportReport() {
    try {
      const tickets = await fsGetAll('support_tickets');
      const messages = await fsGetAll('chat_messages');

      const report = {
        totalTickets: tickets.length,
        openTickets: tickets.filter(t => t.status === 'open').length,
        inProgressTickets: tickets.filter(t => t.status === 'in-progress').length,
        resolvedTickets: tickets.filter(t => t.status === 'resolved').length,
        closedTickets: tickets.filter(t => t.status === 'closed').length,
        avgResolutionTime: 0,
        avgRating: 0,
        totalMessages: messages.length,
        highPriorityTickets: tickets.filter(t => t.priority === 'high' || t.priority === 'urgent').length,
        staffPerformance: {},
        ticketsByPriority: {
          low: tickets.filter(t => t.priority === 'low').length,
          medium: tickets.filter(t => t.priority === 'medium').length,
          high: tickets.filter(t => t.priority === 'high').length,
          urgent: tickets.filter(t => t.priority === 'urgent').length
        }
      };

      const resolvedTickets = tickets.filter(t => t.closedAt && t.createdAt);
      if (resolvedTickets.length > 0) {
        const times = resolvedTickets.map(t => {
          const created = t.createdAt?.toDate ? t.createdAt.toDate().getTime() : new Date(t.createdAt).getTime();
          const closed = t.closedAt?.toDate ? t.closedAt.toDate().getTime() : new Date(t.closedAt).getTime();
          return (closed - created) / (1000 * 60 * 60);
        });
        report.avgResolutionTime = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1);
      }

      const ratedTickets = tickets.filter(t => t.rating > 0);
      if (ratedTickets.length > 0) {
        const avgRating = ratedTickets.reduce((sum, t) => sum + t.rating, 0) / ratedTickets.length;
        report.avgRating = avgRating.toFixed(1);
      }

      const staffStats = {};
      tickets.forEach(ticket => {
        if (ticket.assignedTo) {
          if (!staffStats[ticket.assignedTo]) {
            staffStats[ticket.assignedTo] = { handled: 0, resolved: 0, avgRating: 0 };
          }
          staffStats[ticket.assignedTo].handled++;
          if (ticket.status === 'resolved' || ticket.status === 'closed') {
            staffStats[ticket.assignedTo].resolved++;
          }
          if (ticket.rating > 0) {
            staffStats[ticket.assignedTo].avgRating += ticket.rating;
          }
        }
      });

      Object.entries(staffStats).forEach(([staffId, stats]) => {
        stats.avgRating = stats.handled > 0 ? (stats.avgRating / stats.handled).toFixed(1) : 0;
        report.staffPerformance[staffId] = stats;
      });

      return report;
    } catch (error) {
      console.error('Error generating support report:', error);
      return {};
    }
  }

  // ─── تصدير التقرير الفعلي لـ CSV ────────────────────────────────
  exportToCSV(data, filename = 'report.csv') {
    let csv = '';
    
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      csv = headers.join(',') + '\n';
      
      data.forEach(row => {
        const values = headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        });
        csv += values.join(',') + '\n';
      });
    } else {
      Object.entries(data).forEach(([key, value]) => {
        csv += `${key},${value}\n`;
      });
    }

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}

// ─── Global Instance ───────────────────────────────────────────────
const reportsManager = new ReportsManager();

// ─── State Management ──────────────────────────────────────────────
window.ReportsState = window.ReportsState || {
  startDate: '',
  endDate: '',
  interval: 'daily',
  department: 'all',
  tab: 'overview',
  calculatorComm: 10,
  calculatorTax: 5,
};

// ─── Quick Date Filters Helper ─────────────────────────────────────
window.ph49_setQuickFilter = function(range) {
  const today = new Date();
  let start = new Date();
  let end = new Date();

  switch(range) {
    case 'today':
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      break;
    case 'yesterday':
      start.setDate(today.getDate() - 1);
      start.setHours(0,0,0,0);
      end.setDate(today.getDate() - 1);
      end.setHours(23,59,59,999);
      break;
    case 'week':
      const day = today.getDay();
      start.setDate(today.getDate() - day);
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      break;
    case 'month':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'year':
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case 'all':
      start = new Date(2020, 0, 1);
      end = new Date(today.getFullYear() + 1, 11, 31);
      break;
  }

  window.ReportsState.startDate = start.toISOString().split('T')[0];
  window.ReportsState.endDate = end.toISOString().split('T')[0];

  const startInp = document.getElementById('report-start-date');
  const endInp = document.getElementById('report-end-date');
  if (startInp) startInp.value = window.ReportsState.startDate;
  if (endInp) endInp.value = window.ReportsState.endDate;

  window.generateReports();
};

// ─── Calculator Platform profit solver ──────────────────────────────
window.ph49_calculatePlatformFees = function() {
  const commPct = parseFloat(document.getElementById('calc-comm-pct')?.value) || 0;
  const taxPct = parseFloat(document.getElementById('calc-tax-pct')?.value) || 0;
  
  window.ReportsState.calculatorComm = commPct;
  window.ReportsState.calculatorTax = taxPct;

  const rev = window.__currentReportData?.totalRevenue || 0;
  const cost = window.__currentReportData?.totalCost || 0;
  
  const commAmount = Math.round(rev * (commPct / 100));
  const taxAmount = Math.round(rev * (taxPct / 100));
  const vendorPayout = Math.max(0, rev - commAmount - taxAmount);
  const netAdminProfit = commAmount - cost;

  const commEl = document.getElementById('calc-res-comm');
  const taxEl = document.getElementById('calc-res-tax');
  const payoutEl = document.getElementById('calc-res-payout');
  const adminProfitEl = document.getElementById('calc-res-admin-profit');

  if (commEl) commEl.textContent = commAmount.toLocaleString() + ' ر.ي';
  if (taxEl) taxEl.textContent = taxAmount.toLocaleString() + ' ر.ي';
  if (payoutEl) payoutEl.textContent = vendorPayout.toLocaleString() + ' ر.ي';
  if (adminProfitEl) {
    adminProfitEl.textContent = netAdminProfit.toLocaleString() + ' ر.ي';
    adminProfitEl.style.color = netAdminProfit >= 0 ? '#10b981' : '#ef4444';
  }
};

// ─── Dynamic Aggregated Report Generation ───────────────────────────
window.generateReports = async function() {
  const startVal = document.getElementById('report-start-date')?.value;
  const endVal = document.getElementById('report-end-date')?.value;
  const interval = document.getElementById('report-interval')?.value || 'daily';
  const dept = document.getElementById('report-dept')?.value || 'all';

  window.ReportsState.startDate = startVal || '';
  window.ReportsState.endDate = endVal || '';
  window.ReportsState.interval = interval;
  window.ReportsState.department = dept;

  const startDate = startVal ? new Date(startVal + 'T00:00:00') : new Date(0);
  const endDate = endVal ? new Date(endVal + 'T23:59:59') : new Date();

  showLoader('جاري معالجة التقارير...');
  const salesData = await reportsManager.getSalesReport(startDate, endDate);
  window.__currentReportData = salesData;
  hideLoader();

  await switchReportTab(window.ReportsState.tab);
};

// ─── Chart.js Rendering Logic ──────────────────────────────────────
let __reports_charts = {};
window.ph49_drawReportCharts = function(salesData, tab) {
  if (typeof Chart === 'undefined') return;

  for (const id of Object.keys(__reports_charts)) {
    try { __reports_charts[id].destroy(); } catch(_) {}
    delete __reports_charts[id];
  }

  const isLight = document.body.classList.contains('light-theme');
  Chart.defaults.color = isLight ? '#374151' : '#cbd5e1';
  Chart.defaults.font.family = "'Cairo','Segoe UI',sans-serif";
  Chart.defaults.font.size = 11;
  const gridColor = isLight ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)';

  if (tab === 'overview' || tab === 'sales') {
    const timeCanvas = document.getElementById('reports-chart-time');
    if (timeCanvas) {
      const interval = window.ReportsState.interval || 'daily';
      const series = salesData.timeSeries[interval] || {};
      
      const keys = Object.keys(series).sort();
      const labels = keys;
      const revs = keys.map(k => series[k].revenue);
      const profits = keys.map(k => series[k].profit);
      const counts = keys.map(k => series[k].count);

      __reports_charts.time = new Chart(timeCanvas, {
        type: 'line',
        data: {
          labels: labels.map(l => {
            if (interval === 'monthly') {
              const parts = l.split('-');
              const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
              return `${monthsAr[parseInt(parts[1])-1]} ${parts[0]}`;
            }
            return l;
          }),
          datasets: [
            { label: '💰 الإيرادات (ر.ي)', data: revs, borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.1)', tension: 0.35, fill: true, yAxisID: 'y' },
            { label: '🟢 صافي الأرباح (ر.ي)', data: profits, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.05)', tension: 0.35, fill: true, yAxisID: 'y' },
            { label: '📦 عدد الطلبات', data: counts, borderColor: '#3b82f6', tension: 0.35, yAxisID: 'y1', pointStyle: 'circle' }
          ]
        },
        options: {
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: { grid: { color: gridColor } },
            y: { position: 'right', grid: { color: gridColor }, beginAtZero: true, title: { display: true, text: 'المبالغ المالية' } },
            y1: { position: 'left', grid: { display: false }, beginAtZero: true, title: { display: true, text: 'الكمية/العدد' } }
          },
          plugins: { legend: { position: 'top' } }
        }
      });
    }

    const deptCanvas = document.getElementById('reports-chart-dept');
    if (deptCanvas) {
      const depts = salesData.departments || {};
      const labels = Object.values(depts).map(d => d.name.split(' ').slice(1).join(' '));
      const revs = Object.values(depts).map(d => d.revenue);
      const colors = ['#a855f7', '#eab308', '#3b82f6', '#ec4899', '#10b981'];

      __reports_charts.dept = new Chart(deptCanvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: revs,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#1a1232'
          }]
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          },
          cutout: '65%'
        }
      });
    }
  }
};

// ─── Rendering Functions ──────────────────────────────────────────

// ─── عرض لوحة التقارير ────────────────────────────────────────────
function renderReportsPage() {
  if (!window.ReportsState.startDate || !window.ReportsState.endDate) {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    window.ReportsState.startDate = start.toISOString().split('T')[0];
    window.ReportsState.endDate = end.toISOString().split('T')[0];
  }

  return `
  <div class="reports-page">
    <div style="padding:8px 0 0"><button class="back-btn" onclick="goBack('admin')">→ رجوع لوحة التحكم</button></div>
    
    <div class="reports-header">
      <h2>📊 التقارير المالية والتحليلات المتقدمة</h2>
    </div>

    <!-- لوحة التحكم والفلاتر -->
    <div class="reports-control-panel">
      <div class="reports-filters-group">
        <div class="date-range-selector">
          <label style="font-size:12px;color:rgba(255,255,255,0.6)">من:</label>
          <input type="date" id="report-start-date" value="${window.ReportsState.startDate}">
          <label style="font-size:12px;color:rgba(255,255,255,0.6)">إلى:</label>
          <input type="date" id="report-end-date" value="${window.ReportsState.endDate}">
        </div>
        
        <select class="reports-filter-select" id="report-interval" onchange="generateReports()">
          <option value="daily" ${window.ReportsState.interval === 'daily' ? 'selected' : ''}>📅 تقرير يومي</option>
          <option value="weekly" ${window.ReportsState.interval === 'weekly' ? 'selected' : ''}>🗓️ تقرير أسبوعي</option>
          <option value="monthly" ${window.ReportsState.interval === 'monthly' ? 'selected' : ''}>📆 تقرير شهري</option>
          <option value="yearly" ${window.ReportsState.interval === 'yearly' ? 'selected' : ''}>⏳ تقرير سنوي</option>
        </select>

        <select class="reports-filter-select" id="report-dept" onchange="generateReports()">
          <option value="all" ${window.ReportsState.department === 'all' ? 'selected' : ''}>💼 جميع الأقسام</option>
          <option value="bookings" ${window.ReportsState.department === 'bookings' ? 'selected' : ''}>📅 الحجوزات والخدمات</option>
          <option value="stores" ${window.ReportsState.department === 'stores' ? 'selected' : ''}>🏪 المتاجر التقليدية</option>
          <option value="professions" ${window.ReportsState.department === 'professions' ? 'selected' : ''}>🛠️ المهن والخدمات</option>
          <option value="rentals" ${window.ReportsState.department === 'rentals' ? 'selected' : ''}>🏷️ التأجير</option>
          <option value="digital" ${window.ReportsState.department === 'digital' ? 'selected' : ''}>⚡ الشحن والمنتجات الرقمية</option>
        </select>
      </div>

      <div class="reports-filters-group">
        <button class="btn btn-secondary" onclick="ph49_setQuickFilter('today')" style="padding:6px 10px;font-size:11px">اليوم</button>
        <button class="btn btn-secondary" onclick="ph49_setQuickFilter('yesterday')" style="padding:6px 10px;font-size:11px">أمس</button>
        <button class="btn btn-secondary" onclick="ph49_setQuickFilter('week')" style="padding:6px 10px;font-size:11px">الأسبوع</button>
        <button class="btn btn-secondary" onclick="ph49_setQuickFilter('month')" style="padding:6px 10px;font-size:11px">الشهر</button>
        <button class="btn btn-secondary" onclick="ph49_setQuickFilter('year')" style="padding:6px 10px;font-size:11px">العام</button>
        <button class="btn btn-secondary" onclick="ph49_setQuickFilter('all')" style="padding:6px 10px;font-size:11px">الكل</button>
        <button class="btn btn-primary" onclick="generateReports()" style="padding:8px 16px;font-size:13px;border-radius:10px">🔄 تحديث</button>
      </div>
    </div>

    <!-- التبويبات -->
    <div class="reports-tabs">
      <button class="report-tab-btn active" id="tab-overview" onclick="switchReportTab('overview')">📈 نظرة مالية عامة</button>
      <button class="report-tab-btn" id="tab-sales" onclick="switchReportTab('sales')">💰 تفاصيل العمليات والأقسام</button>
      <button class="report-tab-btn" id="tab-vendors" onclick="switchReportTab('vendors')">🏪 أداء المزودين والبائعين</button>
      <button class="report-tab-btn" id="tab-customers" onclick="switchReportTab('customers')">👥 تحليلات العملاء</button>
      <button class="report-tab-btn" id="tab-support" onclick="switchReportTab('support')">🎧 تقارير الدعم والشكاوى</button>
      <button class="report-tab-btn" id="tab-ratings" onclick="switchReportTab('ratings')">⭐ الجودة والتقييمات</button>
    </div>

    <!-- المحتوى -->
    <div class="reports-content" id="reports-content">
      <div class="loading">⏳ جاري معالجة البيانات المالية...</div>
    </div>
  </div>
  `;
}

// ─── تبديل التبويبات وتفعيل المخططات البيانية ──────────────────────
async function switchReportTab(tab) {
  window.ReportsState.tab = tab;
  
  document.querySelectorAll('.report-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById('tab-' + tab);
  if (activeBtn) activeBtn.classList.add('active');

  const content = document.getElementById('reports-content');
  if (!content) return;

  if (!window.__currentReportData) {
    const startVal = document.getElementById('report-start-date')?.value;
    const endVal = document.getElementById('report-end-date')?.value;
    const startDate = startVal ? new Date(startVal + 'T00:00:00') : new Date(0);
    const endDate = endVal ? new Date(endVal + 'T23:59:59') : new Date();
    window.__currentReportData = await reportsManager.getSalesReport(startDate, endDate);
  }

  const salesData = window.__currentReportData;
  let reportHtml = '';

  switch (tab) {
    case 'overview':
      reportHtml = await renderOverviewReport(salesData);
      break;
    case 'sales':
      reportHtml = await renderSalesReport(salesData);
      break;
    case 'vendors':
      reportHtml = await renderVendorsReport(salesData);
      break;
    case 'customers':
      reportHtml = await renderCustomersReport(salesData);
      break;
    case 'support':
      reportHtml = await renderSupportReport(salesData);
      break;
    case 'ratings':
      reportHtml = await renderRatingsReport(salesData);
      break;
  }

  content.innerHTML = reportHtml;
  
  setTimeout(() => {
    ph49_drawReportCharts(salesData, tab);
    if (tab === 'overview') {
      ph49_calculatePlatformFees();
    }
  }, 100);
}

// ─── نظرة مالية عامة ───────────────────────────────────────────────
async function renderOverviewReport(salesData) {
  const customerAnalytics = await reportsManager.getCustomerAnalytics();
  const walletReport = await reportsManager.getWalletReport();

  const rev = salesData.totalRevenue || 0;
  const cost = salesData.totalCost || 0;
  const profit = salesData.totalProfit || 0;
  const ordersCount = salesData.totalOrders || 0;
  const aov = salesData.avgOrderValue || 0;

  return `
  <div class="overview-report">
    <!-- كروت إحصائيات الأداء KPIs -->
    <div class="key-metrics">
      <div class="metric-card orders-card">
        <div class="metric-value">${ordersCount.toLocaleString()}</div>
        <div class="metric-label">📦 إجمالي العمليات</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${rev.toLocaleString()} <span style="font-size:12px">ر</span></div>
        <div class="metric-label">💰 الإيرادات المحصلة</div>
      </div>
      <div class="metric-card cost-card">
        <div class="metric-value">${cost.toLocaleString()} <span style="font-size:12px">ر</span></div>
        <div class="metric-label">💸 إجمالي التكلفة الكلية</div>
      </div>
      <div class="metric-card profit-card">
        <div class="metric-value" style="color:#10b981">${profit.toLocaleString()} <span style="font-size:12px">ر</span></div>
        <div class="metric-label">🟢 صافي الأرباح التشغيلية</div>
      </div>
      <div class="metric-card comm-card">
        <div class="metric-value">${aov.toLocaleString()} <span style="font-size:12px">ر</span></div>
        <div class="metric-label">🧾 متوسط قيمة المعاملة</div>
      </div>
    </div>

    <!-- المخططات والحاسبة التفاعلية -->
    <div class="reports-grid-layout">
      <!-- مخطط خطي للأرباح والمبيعات -->
      <div class="overview-section" style="display:flex;flex-direction:column;gap:12px">
        <h3>📉 مخطط المبيعات وصافي الأرباح بمرور الوقت (${window.ReportsState.interval === 'daily' ? 'يومي' : window.ReportsState.interval === 'weekly' ? 'أسبوعي' : window.ReportsState.interval === 'monthly' ? 'شهري' : 'سنوي'})</h3>
        <div style="position:relative;height:340px;width:100%">
          <canvas id="reports-chart-time"></canvas>
        </div>
      </div>

      <!-- حاسبة العمولات والأرباح التفاعلية للإدارة -->
      <div class="reports-calculator-card" style="display:flex;flex-direction:column;gap:12px">
        <h3>🧮 حاسبة العمولات والأرباح التفاعلية</h3>
        <div style="font-size:12px;color:rgba(255,255,255,0.65);line-height:1.5;margin-bottom:6px">تتيح لك حساب العمولات، الضرائب المستحقة، وصافي الحصة التشغيلية للإدارة من إجمالي الإيرادات.</div>
        
        <div class="calc-field-group">
          <div class="calc-input-row">
            <label>نسبة العمولة الافتراضية (%)</label>
            <input type="number" id="calc-comm-pct" value="${window.ReportsState.calculatorComm}" min="0" max="100" oninput="ph49_calculatePlatformFees()">
          </div>
          <div class="calc-input-row">
            <label>نسبة ضريبة المعاملات (%)</label>
            <input type="number" id="calc-tax-pct" value="${window.ReportsState.calculatorTax}" min="0" max="100" oninput="ph49_calculatePlatformFees()">
          </div>
        </div>

        <div class="calc-result-list">
          <div class="calc-res-item">
            <span class="res-lbl">إجمالي عمولة المنصة:</span>
            <span class="res-val" id="calc-res-comm">0 ر.ي</span>
          </div>
          <div class="calc-res-item">
            <span class="res-lbl">إجمالي مبالغ الضرائب:</span>
            <span class="res-val" id="calc-res-tax">0 ر.ي</span>
          </div>
          <div class="calc-res-item">
            <span class="res-lbl">الحصة المستحقة للبائعين:</span>
            <span class="res-val" id="calc-res-payout">0 ر.ي</span>
          </div>
          <div class="calc-res-item highlight">
            <span class="res-lbl">صافي ربح الإدارة الفعلي:</span>
            <span class="res-val" id="calc-res-admin-profit">0 ر.ي</span>
          </div>
        </div>
      </div>
    </div>

    <!-- شبكة الإحصائيات الإضافية -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="overview-section">
        <h3>👥 تحليلات قاعدة العملاء</h3>
        <div class="stats-grid">
          <div class="stat-item"><span class="stat-label">المستخدمين المسجلين:</span><span class="stat-value">${customerAnalytics.totalCustomers || 0}</span></div>
          <div class="stat-item"><span class="stat-label">النشطين (خلال 30 يوم):</span><span class="stat-value">${customerAnalytics.activeCustomers || 0}</span></div>
          <div class="stat-item"><span class="stat-label">عملاء كرروا الشراء:</span><span class="stat-value">${customerAnalytics.repeatCustomers || 0}</span></div>
          <div class="stat-item"><span class="stat-label">معدل العميل الفردي:</span><span class="stat-value">${customerAnalytics.avgOrderValue || 0} ر</span></div>
        </div>
      </div>
      <div class="overview-section">
        <h3>💰 إحصائيات المحافظ الإلكترونية</h3>
        <div class="stats-grid">
          <div class="stat-item"><span class="stat-label">إجمالي أرصدة المحافظ:</span><span class="stat-value">${(walletReport.totalBalances || 0).toLocaleString()} ر</span></div>
          <div class="stat-item"><span class="stat-label">المحافظ المشحونة:</span><span class="stat-value">${walletReport.activeWallets || 0}</span></div>
          <div class="stat-item"><span class="stat-label">إيداعات مسجلة:</span><span class="stat-value">${(walletReport.totalCredits || 0).toLocaleString()} ر</span></div>
          <div class="stat-item"><span class="stat-label">خصومات مسجلة:</span><span class="stat-value">${(walletReport.totalDebits || 0).toLocaleString()} ر</span></div>
        </div>
      </div>
    </div>

    <!-- أزرار التصدير والطباعة -->
    <div class="export-buttons">
      <button class="btn btn-outline" onclick="exportReport('overview', 'csv')">📥 تصدير كشف الإجماليات (CSV)</button>
      <button class="btn btn-outline" onclick="exportReport('overview', 'pdf')">📄 طباعة تقرير شامل (PDF)</button>
    </div>
  </div>
  `;
}

// ─── تفاصيل العمليات والأقسام ──────────────────────────────────────
async function renderSalesReport(salesData) {
  const interval = window.ReportsState.interval || 'daily';
  const series = salesData.timeSeries[interval] || {};
  const keys = Object.keys(series).sort().reverse();
  const depts = salesData.departments || {};
  const intervalLabel = interval === 'daily' ? 'اليوم' : interval === 'weekly' ? 'الأسبوع' : interval === 'monthly' ? 'الشهر' : 'العام';

  const deptBadge = (k) => {
    const icon = k === 'bookings' ? '📅' : k === 'stores' ? '🏪' : k === 'professions' ? '🛠️' : k === 'rentals' ? '🏷️' : '⚡';
    return `<span class="badge-dept badge-dept-${k}">${icon} ${depts[k].name.split(' ')[1] || depts[k].name}</span>`;
  };

  return `
  <div class="sales-report">
    <div class="reports-grid-layout">
      <!-- جدول المبيعات الدوري بالتفصيل -->
      <div class="report-section" style="overflow-x:auto">
        <h3>📊 تفاصيل المبيعات الزمنية حسب الفترات (${intervalLabel})</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>الفترة (${intervalLabel})</th>
              <th>عدد الطلبات</th>
              <th>الإيرادات المحصلة</th>
              <th>التكاليف الكلية</th>
              <th>صافي الأرباح</th>
            </tr>
          </thead>
          <tbody>
            ${keys.length ? keys.map(k => `
            <tr>
              <td style="font-weight:700;direction:ltr">${k}</td>
              <td>${series[k].count.toLocaleString()}</td>
              <td>${series[k].revenue.toLocaleString()} ر.ي</td>
              <td>${series[k].cost.toLocaleString()} ر.ي</td>
              <td style="color:${series[k].profit >= 0 ? '#10b981' : '#ef4444'};font-weight:700">
                ${series[k].profit.toLocaleString()} ر.ي
              </td>
            </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">لا توجد عمليات مبيعات مسجلة في هذه الفترة</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- تفصيل وتوزيع مبيعات الأقسام -->
      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="report-section">
          <h3>🍩 توزيع الإيرادات حسب أقسام المنصة</h3>
          <div style="position:relative;height:240px;width:100%">
            <canvas id="reports-chart-dept"></canvas>
          </div>
        </div>

        <div class="report-section">
          <h3>💼 المبيعات حسب الأقسام التشغيلية</h3>
          <table class="report-table">
            <thead>
              <tr>
                <th>القسم</th>
                <th>العمليات</th>
                <th>الإيرادات</th>
                <th>الأرباح</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(depts).map(k => `
              <tr>
                <td>${deptBadge(k)}</td>
                <td>${depts[k].count}</td>
                <td style="font-weight:700">${depts[k].revenue.toLocaleString()} ر</td>
                <td style="color:${depts[k].profit >= 0 ? '#10b981' : '#ef4444'};font-weight:700">${depts[k].profit.toLocaleString()} ر</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- أزرار التصدير -->
    <div class="export-buttons">
      <button class="btn btn-outline" onclick="exportReport('sales', 'csv')">📥 تصدير مبيعات الفترات (CSV)</button>
      <button class="btn btn-outline" onclick="exportReport('sales_depts', 'csv')">📥 تصدير تقرير الأقسام (CSV)</button>
    </div>
  </div>
  `;
}

// ─── تفاصيل الاستجابة ─────────────────────────────────────────────
function _fmtResponseTime(secs) {
  if (secs == null) return '<span style="color:rgba(255,255,255,0.4)">—</span>';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const txt = m > 0 ? `${m}د ${s}ث` : `${s}ث`;
  const color = secs <= 120 ? '#10b981' : secs <= 300 ? '#f59e0b' : '#ef4444';
  return `<span style="color:${color};font-weight:800">${txt}</span>`;
}

// ─── أداء المزودين والبائعين ───────────────────────────────────────
async function renderVendorsReport(salesData) {
  const vendorPerformance = await reportsManager.getVendorPerformance();

  return `
  <div class="vendors-report">
    <div class="report-section">
      <h3>🏪 تقرير أداء ومبيعات المزودين والبائعين</h3>
      <div style="overflow-x:auto">
        <table class="report-table full-width" style="min-width:900px">
          <thead>
            <tr>
              <th>المزود / المتجر</th>
              <th>إجمالي الطلبات</th>
              <th>المكتملة</th>
              <th>الملغاة</th>
              <th>نسبة النجاح</th>
              <th>⏱ متوسط الاستجابة</th>
              <th>✅ نسبة القبول</th>
              <th>الإيرادات</th>
              <th>التقييم</th>
              <th>تاريخ الانضمام</th>
            </tr>
          </thead>
          <tbody>
            ${vendorPerformance.length ? vendorPerformance.map(v => `
            <tr>
              <td style="font-weight:800;color:#fff">${v.vendorName}</td>
              <td>${v.totalOrders}</td>
              <td style="color:#10b981">${v.completedOrders}</td>
              <td style="color:#ef4444">${v.cancelledOrders}</td>
              <td>
                <span style="font-weight:800;color:${Number(v.completionRate) >= 80 ? '#10b981' : Number(v.completionRate) >= 50 ? '#f59e0b' : '#ef4444'}">
                  ${v.completionRate}%
                </span>
              </td>
              <td>${_fmtResponseTime(v.avgResponseSecs)}</td>
              <td>
                ${v.acceptRate != null
                  ? `<span style="font-weight:800;color:${Number(v.acceptRate) >= 80 ? '#10b981' : Number(v.acceptRate) >= 50 ? '#f59e0b' : '#ef4444'}">${v.acceptRate}%</span>
                     <span style="font-size:10px;color:rgba(255,255,255,0.4)">(${v.acceptedOrders}✅ / ${v.rejectedOrders}❌)</span>`
                  : '<span style="color:rgba(255,255,255,0.45)">—</span>'}
              </td>
              <td style="font-weight:700;color:#c4b5fd">${v.totalRevenue.toLocaleString()} ر.ي</td>
              <td style="font-weight:700">⭐ ${v.avgRating || '—'}</td>
              <td style="font-size:11px;color:rgba(255,255,255,0.5)">${v.joinDate}</td>
            </tr>`).join('') : '<tr><td colspan="10" style="text-align:center;color:var(--text-muted)">لا يوجد بائعون مسجلون حالياً</td></tr>'}
          </tbody>
        </table>
      </div>

      <div style="margin-top:16px;padding:12px 16px;background:rgba(245,158,11,0.08);border-radius:12px;border:1px solid rgba(245,158,11,0.2);font-size:12px;color:rgba(255,255,255,0.6)">
        ⏱ <strong>سرعة استجابة المزودين:</strong>
        <span style="color:#10b981;margin:0 6px">● أقل من دقيقتين = سريع جداً</span> ·
        <span style="color:#f59e0b;margin:0 6px">● 2-5 دقائق = متوسط</span> ·
        <span style="color:#ef4444;margin:0 6px">● أكثر من 5 دقائق = بطيء</span>
      </div>
    </div>

    <!-- أزرار التصدير -->
    <div class="export-buttons">
      <button class="btn btn-outline" onclick="exportReport('vendors', 'csv')">📥 تصدير مبيعات المزودين (CSV)</button>
    </div>
  </div>
  `;
}

// ─── تحليلات العملاء ───────────────────────────────────────────────
async function renderCustomersReport(salesData) {
  const customerAnalytics = await reportsManager.getCustomerAnalytics();

  return `
  <div class="customers-report">
    <div class="reports-grid-layout">
      <!-- قائمة أفضل العملاء -->
      <div class="report-section">
        <h3>🌟 أفضل 10 عملاء شراءً وتعاملاً</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>العميل</th>
              <th>إجمالي المعاملات</th>
              <th>إجمالي المدفوعات</th>
              <th>تاريخ آخر عملية</th>
            </tr>
          </thead>
          <tbody>
            ${customerAnalytics.topCustomers?.length ? customerAnalytics.topCustomers.slice(0, 10).map(c => `
            <tr>
              <td style="font-weight:700">${c.customerName}</td>
              <td>${c.orderCount}</td>
              <td style="color:#c4b5fd;font-weight:700">${c.totalSpent.toLocaleString()} ر.ي</td>
              <td style="font-size:11px;color:rgba(255,255,255,0.5)">${c.lastOrderDate}</td>
            </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">لا توجد معاملات مسجلة للعملاء</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- تصنيف وتقسيم العملاء -->
      <div class="report-section" style="display:flex;flex-direction:column;gap:16px">
        <h3>🎯 تصنيف وتقسيم العملاء حسب حجم الإنفاق</h3>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:14px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:700;color:#10b981">💎 فئة النخبة (High Value)</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px">العملاء الذين أنفقوا أكثر من 5,000 ريال</div>
            </div>
            <div style="font-size:24px;font-weight:800;color:#10b981">${customerAnalytics.customerSegmentation?.highValue || 0}</div>
          </div>
          <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:12px;padding:14px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:700;color:#3b82f6">💼 فئة المتوسطين (Medium Value)</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px">العملاء الذين أنفقوا ما بين 1,000 و 5,000 ريال</div>
            </div>
            <div style="font-size:24px;font-weight:800;color:#3b82f6">${customerAnalytics.customerSegmentation?.mediumValue || 0}</div>
          </div>
          <div style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.2);border-radius:12px;padding:14px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:700;color:#a855f7">🌱 فئة المبتدئين (Low Value)</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px">العملاء الذين أنفقوا أقل من 1,000 ريال</div>
            </div>
            <div style="font-size:24px;font-weight:800;color:#a855f7">${customerAnalytics.customerSegmentation?.lowValue || 0}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- أزرار التصدير -->
    <div class="export-buttons">
      <button class="btn btn-outline" onclick="exportReport('customers', 'csv')">📥 تصدير قائمة العملاء المميزين (CSV)</button>
    </div>
  </div>
  `;
}

// ─── تقارير الدعم والشكاوى ─────────────────────────────────────────
async function renderSupportReport(salesData) {
  const supportReport = await reportsManager.getSupportReport();

  return `
  <div class="support-report">
    <div class="report-section">
      <h3>🎧 إحصائيات وجودة دعم العملاء</h3>
      <div class="support-stats-grid">
        <div class="stat-card">
          <div class="stat-num">${supportReport.totalTickets || 0}</div>
          <div class="stat-label">إجمالي التذاكر</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="color:#f59e0b">${supportReport.openTickets || 0}</div>
          <div class="stat-label">تذاكر مفتوحة</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="color:#3b82f6">${supportReport.inProgressTickets || 0}</div>
          <div class="stat-label">قيد المعالجة</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="color:#10b981">${supportReport.resolvedTickets || 0}</div>
          <div class="stat-label">محلولة</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="color:#ef4444">${supportReport.closedTickets || 0}</div>
          <div class="stat-label">مغلقة</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">${supportReport.avgResolutionTime || 0} ساعة</div>
          <div class="stat-label">متوسط وقت الحل</div>
        </div>
      </div>
    </div>

    <!-- فرز الاستعجال وتقارير الموظفين -->
    <div class="reports-grid-layout">
      <div class="report-section">
        <h3>⚠️ التذاكر والمشكلات حسب الأولوية</h3>
        <table class="report-table">
          <tr>
            <td>🟢 منخفضة الاستعجال:</td>
            <td><strong>${supportReport.ticketsByPriority?.low || 0} تذكرة</strong></td>
          </tr>
          <tr>
            <td>🟡 متوسطة الاستعجال:</td>
            <td><strong>${supportReport.ticketsByPriority?.medium || 0} تذكرة</strong></td>
          </tr>
          <tr>
            <td>🔴 عالية الاستعجال:</td>
            <td><strong>${supportReport.ticketsByPriority?.high || 0} تذكرة</strong></td>
          </tr>
          <tr>
            <td>⛔ عاجلة جداً / طارئة:</td>
            <td><strong>${supportReport.ticketsByPriority?.urgent || 0} تذكرة</strong></td>
          </tr>
        </table>
      </div>

      <div class="report-section">
        <h3>👥 تقرير أداء موظفي خدمة العملاء</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>الموظف</th>
              <th>المعالجة</th>
              <th>المحلولة</th>
              <th>التقييم</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(supportReport.staffPerformance || {}).map(staffId => {
              const staff = (AppData.users||[]).find(u=>u.uid===staffId || u.id===staffId);
              const p = supportReport.staffPerformance[staffId];
              return `
              <tr>
                <td style="font-weight:700">${staff?.name || staffId}</td>
                <td>${p.handled}</td>
                <td style="color:#10b981">${p.resolved}</td>
                <td>⭐ ${p.avgRating}</td>
              </tr>`;
            }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">لم يتم تعيين أي موظف لتذاكر الدعم بعد</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- التصدير -->
    <div class="export-buttons">
      <button class="btn btn-outline" onclick="exportReport('support', 'csv')">📥 تصدير تقرير الدعم والشكاوى (CSV)</button>
    </div>
  </div>
  `;
}

// ─── الجودة والتقييمات ─────────────────────────────────────────────
async function renderRatingsReport(salesData) {
  const ratingsReport = await reportsManager.getRatingsReport();

  return `
  <div class="ratings-report">
    <div class="reports-grid-layout">
      <div class="report-section">
        <h3>⭐ ملخص تقييمات الجودة والرضا للخدمات</h3>
        <table class="report-table">
          <tr>
            <td>إجمالي التقييمات المسجلة:</td>
            <td><strong>${ratingsReport.totalRatings || 0} تقييم</strong></td>
          </tr>
          <tr>
            <td>متوسط تقييم رضا العملاء:</td>
            <td><strong style="color:#eab308;font-size:18px">⭐ ${ratingsReport.averageRating || 0} / 5</strong></td>
          </tr>
        </table>
      </div>

      <div class="report-section">
        <h3>📊 توزيع مستويات التقييم (النجوم)</h3>
        <ul style="list-style: none; padding:0; display:flex; flex-direction:column; gap:8px; margin:0">
          <li style="display:flex; justify-content:space-between"><span>⭐⭐⭐⭐⭐ 5 نجوم:</span> <strong>${ratingsReport.ratingDistribution?.[5] || 0} تقييم</strong></li>
          <li style="display:flex; justify-content:space-between"><span>⭐⭐⭐⭐ 4 نجوم:</span> <strong>${ratingsReport.ratingDistribution?.[4] || 0} تقييم</strong></li>
          <li style="display:flex; justify-content:space-between"><span>⭐⭐⭐ 3 نجوم:</span> <strong>${ratingsReport.ratingDistribution?.[3] || 0} تقييم</strong></li>
          <li style="display:flex; justify-content:space-between"><span>⭐⭐ 2 نجوم:</span> <strong>${ratingsReport.ratingDistribution?.[2] || 0} تقييم</strong></li>
          <li style="display:flex; justify-content:space-between"><span>⭐ 1 نجم:</span> <strong>${ratingsReport.ratingDistribution?.[1] || 0} تقييم</strong></li>
        </ul>
      </div>
    </div>

    <!-- أحدث التعليقات -->
    <div class="report-section">
      <h3>💬 أحدث 10 تعليقات وتقييمات من العملاء</h3>
      <table class="report-table">
        <thead>
          <tr>
            <th>الخدمة / المنتج</th>
            <th>التقييم</th>
            <th>التعليق والملاحظة</th>
            <th>تاريخ التقييم</th>
          </tr>
        </thead>
        <tbody>
          ${ratingsReport.recentReviews?.slice(0, 10).map(r => {
            const svc = AppData.services?.find(s=>s.id===r.serviceId) || AppData.storeProducts?.find(p=>p.id===r.serviceId);
            return `
            <tr>
              <td style="font-weight:700">${svc?.name || r.serviceId}</td>
              <td style="color:#eab308;font-weight:800">⭐ ${r.stars}</td>
              <td>${escHtml(r.comment)}</td>
              <td style="font-size:11px;color:rgba(255,255,255,0.5)">${r.date}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">لا توجد تقييمات مكتوبة مسجلة بعد</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- أزرار التصدير -->
    <div class="export-buttons">
      <button class="btn btn-outline" onclick="exportReport('ratings', 'csv')">📥 تصدير تفاصيل التقييمات والآراء (CSV)</button>
    </div>
  </div>
  `;
}

// ─── ميزة تصدير التقارير الفعلية لـ CSV / PDF ─────────────────────
async function exportReport(reportType, format) {
  const salesData = window.__currentReportData;
  if (!salesData) {
    toast('يرجى توليد التقرير أولاً', 'warning');
    return;
  }

  if (format === 'csv') {
    toast('✅ جاري تصدير التقرير...', 'success');
    let csvData = [];
    let filename = `report_${reportType}.csv`;

    if (reportType === 'overview') {
      csvData = [
        { "المؤشر المالي": "إجمالي الإيرادات", "القيمة (ر.ي)": salesData.totalRevenue },
        { "المؤشر المالي": "إجمالي التكلفة الكلية", "القيمة (ر.ي)": salesData.totalCost },
        { "المؤشر المالي": "صافي الأرباح التشغيلية", "القيمة (ر.ي)": salesData.totalProfit },
        { "المؤشر المالي": "إجمالي العمليات والطلبات", "القيمة (ر.ي)": salesData.totalOrders },
        { "المؤشر المالي": "متوسط قيمة المعاملة", "القيمة (ر.ي)": salesData.avgOrderValue }
      ];
      filename = `mahjooz-overview-summary.csv`;
    } else if (reportType === 'sales') {
      const interval = window.ReportsState.interval || 'daily';
      const series = salesData.timeSeries[interval] || {};
      csvData = Object.keys(series).sort().map(k => ({
        "الفترة الزمنية": k,
        "عدد الطلبات": series[k].count,
        "الإيرادات المحصلة (ر.ي)": series[k].revenue,
        "التكاليف الكلية (ر.ي)": series[k].cost,
        "صافي الأرباح (ر.ي)": series[k].profit
      }));
      filename = `mahjooz-periodic-sales-${interval}.csv`;
    } else if (reportType === 'sales_depts') {
      const depts = salesData.departments || {};
      csvData = Object.keys(depts).map(k => ({
        "القسم التشغيلي": depts[k].name,
        "عدد العمليات": depts[k].count,
        "إجمالي الإيرادات (ر.ي)": depts[k].revenue,
        "إجمالي التكلفة (ر.ي)": depts[k].cost,
        "صافي الأرباح (ر.ي)": depts[k].profit
      }));
      filename = `mahjooz-departments-sales.csv`;
    } else if (reportType === 'vendors') {
      const vendorPerformance = await reportsManager.getVendorPerformance();
      csvData = vendorPerformance.map(v => ({
        "البائع / المزود": v.vendorName,
        "إجمالي الطلبات": v.totalOrders,
        "الطلبات المكتملة": v.completedOrders,
        "الطلبات الملغاة": v.cancelledOrders,
        "نسبة النجاح (%)": v.completionRate,
        "متوسط الاستجابة (ثواني)": v.avgResponseSecs || '—',
        "نسبة القبول (%)": v.acceptRate || '—',
        "إجمالي المبيعات (ر.ي)": v.totalRevenue,
        "متوسط التقييم": v.avgRating,
        "تاريخ الانضمام": v.joinDate
      }));
      filename = `mahjooz-vendors-performance.csv`;
    } else if (reportType === 'customers') {
      const customerAnalytics = await reportsManager.getCustomerAnalytics();
      csvData = (customerAnalytics.topCustomers || []).map(c => ({
        "العميل": c.customerName,
        "إجمالي المعاملات": c.orderCount,
        "إجمالي الإنفاق (ر.ي)": c.totalSpent,
        "تاريخ آخر معاملة": c.lastOrderDate
      }));
      filename = `mahjooz-top-customers.csv`;
    }

    reportsManager.exportToCSV(csvData, filename);
  } else if (format === 'pdf') {
    toast('✅ جاري تجهيز التقرير للطباعة...', 'success');
    
    const printWindow = window.open('', '', 'height=700,width=900');
    const interval = window.ReportsState.interval || 'daily';
    const series = salesData.timeSeries[interval] || {};
    const keys = Object.keys(series).sort().reverse();
    const depts = salesData.departments || {};
    
    let htmlContent = `
      <div style="direction:rtl;font-family:Arial,sans-serif;padding:30px">
        <h1 style="text-align:center;color:#7c3aed;margin-bottom:5px">منصة محجوز — التقرير المالي الشامل</h1>
        <div style="text-align:center;font-size:12px;color:#555;margin-bottom:30px">الفترة من ${window.ReportsState.startDate} إلى ${window.ReportsState.endDate}</div>
        
        <h2>📊 ملخص المؤشرات المالية الرئيسية</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:30px">
          <tr style="background:#f3f4f6">
            <th style="border:1px solid #ddd;padding:12px;text-align:right">المؤشر</th>
            <th style="border:1px solid #ddd;padding:12px;text-align:right">القيمة</th>
          </tr>
          <tr>
            <td style="border:1px solid #ddd;padding:12px">إجمالي الإيرادات</td>
            <td style="border:1px solid #ddd;padding:12px;font-weight:bold">${salesData.totalRevenue.toLocaleString()} ر.ي</td>
          </tr>
          <tr>
            <td style="border:1px solid #ddd;padding:12px">إجمالي التكلفة الكلية</td>
            <td style="border:1px solid #ddd;padding:12px;font-weight:bold">${salesData.totalCost.toLocaleString()} ر.ي</td>
          </tr>
          <tr>
            <td style="border:1px solid #ddd;padding:12px">صافي الأرباح التشغيلية</td>
            <td style="border:1px solid #ddd;padding:12px;font-weight:bold;color:#10b981">${salesData.totalProfit.toLocaleString()} ر.ي</td>
          </tr>
          <tr>
            <td style="border:1px solid #ddd;padding:12px">إجمالي المعاملات والطلبات</td>
            <td style="border:1px solid #ddd;padding:12px">${salesData.totalOrders.toLocaleString()} عملية</td>
          </tr>
          <tr>
            <td style="border:1px solid #ddd;padding:12px">متوسط قيمة المعاملة</td>
            <td style="border:1px solid #ddd;padding:12px">${salesData.avgOrderValue.toLocaleString()} ر.ي</td>
          </tr>
        </table>

        <h2>💼 مبيعات الأقسام التشغيلية للمنصة</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:30px">
          <thead>
            <tr style="background:#7c3aed;color:#fff">
              <th style="border:1px solid #ddd;padding:12px;text-align:right">القسم</th>
              <th style="border:1px solid #ddd;padding:12px;text-align:right">العمليات</th>
              <th style="border:1px solid #ddd;padding:12px;text-align:right">الإيرادات المحصلة</th>
              <th style="border:1px solid #ddd;padding:12px;text-align:right">صافي الأرباح</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(depts).map(k => `
            <tr>
              <td style="border:1px solid #ddd;padding:12px">${depts[k].name}</td>
              <td style="border:1px solid #ddd;padding:12px">${depts[k].count}</td>
              <td style="border:1px solid #ddd;padding:12px">${depts[k].revenue.toLocaleString()} ر.ي</td>
              <td style="border:1px solid #ddd;padding:12px;font-weight:bold;color:#10b981">${depts[k].profit.toLocaleString()} ر.ي</td>
            </tr>`).join('')}
          </tbody>
        </table>

        <h2>📅 سجل مبيعات الفترات الزمنية (${interval === 'daily' ? 'يومي' : interval === 'weekly' ? 'أسبوعي' : interval === 'monthly' ? 'شهري' : 'سنوي'})</h2>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#e5e7eb">
              <th style="border:1px solid #ddd;padding:10px;text-align:right">الفترة</th>
              <th style="border:1px solid #ddd;padding:10px;text-align:right">العمليات</th>
              <th style="border:1px solid #ddd;padding:10px;text-align:right">الإيرادات</th>
              <th style="border:1px solid #ddd;padding:10px;text-align:right">التكلفة</th>
              <th style="border:1px solid #ddd;padding:10px;text-align:right">الأرباح</th>
            </tr>
          </thead>
          <tbody>
            ${keys.slice(0, 50).map(k => `
            <tr>
              <td style="border:1px solid #ddd;padding:10px;direction:ltr">${k}</td>
              <td style="border:1px solid #ddd;padding:10px">${series[k].count}</td>
              <td style="border:1px solid #ddd;padding:10px">${series[k].revenue.toLocaleString()} ر.ي</td>
              <td style="border:1px solid #ddd;padding:10px">${series[k].cost.toLocaleString()} ر.ي</td>
              <td style="border:1px solid #ddd;padding:10px;font-weight:bold;color:#10b981">${series[k].profit.toLocaleString()} ر.ي</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;

    printWindow.document.write(`
      <html>
      <head>
        <title>منصة محجوز — التقرير المالي</title>
      </head>
      <body onload="window.print();window.close();">
        ${htmlContent}
      </body>
      </html>
    `);
    printWindow.document.close();
  }
}

// تصدير للوصول العالمي
window.renderReportsPage = renderReportsPage;
window.switchReportTab = switchReportTab;
window.exportReport = exportReport;
