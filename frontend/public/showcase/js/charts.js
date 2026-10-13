/**
 * SCM Hub Operations Portal — Powered by SERP Hawk CRM
 * Interactive Chart.js Visualizations System
 */

(function () {
  'use strict';

  let chartsInstances = {};

  // Custom Chart.js Plugin for Center Text in Donut Charts
  const donutCenterTextPlugin = {
    id: 'donutCenterText',
    afterDraw(chart) {
      if (chart.config.type !== 'doughnut') return;
      const { ctx, chartArea: { top, bottom, left, right } } = chart;
      const centerConfig = chart.config.options.plugins?.donutCenter;
      if (!centerConfig) return;

      ctx.save();
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Label (small uppercase)
      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillStyle = isDark ? '#A1A1AA' : '#64748B';
      ctx.fillText(centerConfig.label.toUpperCase(), centerX, centerY - 10);

      // Value (bold)
      ctx.font = '800 17px Inter, sans-serif';
      ctx.fillStyle = isDark ? '#FFFFFF' : '#0F172A';
      ctx.fillText(centerConfig.value, centerX, centerY + 10);

      ctx.restore();
    }
  };

  if (window.Chart) {
    Chart.register(donutCenterTextPlugin);
  }

  function getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      textColor: isDark ? '#F8FAFC' : '#0F172A',
      mutedText: isDark ? '#A1A1AA' : '#64748B',
      gridColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
      cardBg: isDark ? '#0A0A0A' : '#FFFFFF',
      fontFamily: 'Inter, sans-serif'
    };
  }

  // INR formatter — shows ₹X.XL for lakhs, ₹XK for thousands
  function formatINR(value) {
    if (value >= 100000) return '₹' + (value / 100000).toFixed(1) + 'L';
    if (value >= 1000)   return '₹' + (value / 1000).toFixed(0) + 'K';
    return '₹' + value.toLocaleString('en-IN');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Financial Overview — Fees Collected vs Outstanding Receivables (Area/Line)
  // ─────────────────────────────────────────────────────────────────────────────
  function initFinancialOverviewChart() {
    const canvas = document.getElementById('financialOverviewChart');
    if (!canvas || !window.Chart) return;

    if (chartsInstances.financial) chartsInstances.financial.destroy();

    const { textColor, mutedText, gridColor, fontFamily } = getThemeColors();
    const ctx = canvas.getContext('2d');

    const gradCollected = ctx.createLinearGradient(0, 0, 0, 280);
    gradCollected.addColorStop(0, 'rgba(12,79,62,0.45)');
    gradCollected.addColorStop(1, 'rgba(12,79,62,0.0)');

    const gradOutstanding = ctx.createLinearGradient(0, 0, 0, 280);
    gradOutstanding.addColorStop(0, 'rgba(239,68,68,0.2)');
    gradOutstanding.addColorStop(1, 'rgba(239,68,68,0.0)');

    chartsInstances.financial = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
        datasets: [
          {
            label: 'Fees Collected',
            data: [480000, 620000, 750000, 980000, 1160000, 1240000],
            borderColor: '#0C4F3E',
            backgroundColor: gradCollected,
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointBackgroundColor: '#0C4F3E',
            pointRadius: 4,
            pointHoverRadius: 7
          },
          {
            label: 'Outstanding Receivables',
            data: [120000, 180000, 150000, 210000, 320000, 480000],
            borderColor: '#EF4444',
            backgroundColor: gradOutstanding,
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            borderDash: [5, 4],
            pointBackgroundColor: '#EF4444',
            pointRadius: 3,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              boxHeight: 8,
              font: { family: fontFamily, size: 12, weight: '600' },
              color: textColor
            }
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                return ` ${ctx.dataset.label}: ${formatINR(ctx.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: fontFamily, size: 11 }, color: mutedText }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              font: { family: fontFamily, size: 11 },
              color: mutedText,
              callback: (val) => formatINR(val)
            }
          }
        }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Admissions Pipeline — Horizontal Bar Chart (SCM Hub stages)
  // ─────────────────────────────────────────────────────────────────────────────
  function initAdmissionsPipelineChart() {
    const canvas = document.getElementById('admissionsPipelineChart');
    if (!canvas || !window.Chart) return;

    if (chartsInstances.pipeline) chartsInstances.pipeline.destroy();

    const { textColor, mutedText, gridColor, fontFamily } = getThemeColors();
    const ctx = canvas.getContext('2d');

    chartsInstances.pipeline = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['New Inquiry', 'Contacted', 'Counseling', 'Application', 'Enrolled', 'Closed / Lost'],
        datasets: [{
          label: 'Students',
          data: [82, 54, 38, 24, 42, 12],
          backgroundColor: ['#051751', '#006AB3', '#6366F1', '#F59E0B', '#0C4F3E', '#94A3B8'],
          borderRadius: 5,
          barThickness: 16
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(ctx) { return ` ${ctx.raw} Students`; }
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { font: { family: fontFamily, size: 11 }, color: mutedText }
          },
          y: {
            grid: { display: false },
            ticks: { font: { family: fontFamily, size: 11, weight: '600' }, color: textColor }
          }
        }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Donut Chart Helper
  // ─────────────────────────────────────────────────────────────────────────────
  function createDonut(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return null;

    if (chartsInstances[canvasId]) chartsInstances[canvasId].destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const ctx = canvas.getContext('2d');

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: config.labels,
        datasets: [{
          data: config.data,
          backgroundColor: config.colors,
          borderColor: isDark ? '#0A0A0A' : '#FFFFFF',
          borderWidth: 2,
          hoverOffset: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          donutCenter: { label: config.centerLabel, value: config.centerValue },
          tooltip: {
            callbacks: {
              label(ctx) {
                const label = ctx.label || '';
                const val   = ctx.raw;
                const fmt   = config.isCurrency ? formatINR(val) : val;
                return ` ${label}: ${fmt}`;
              }
            }
          }
        }
      }
    });

    chartsInstances[canvasId] = chart;
    return chart;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Six Analytics Donut Visualizations — SCM Hub Data (INR, 248 leads)
  // ─────────────────────────────────────────────────────────────────────────────
  function initSixAnalyticsDonuts() {
    // 1. Lead Pipeline Stages
    createDonut('chartPipelineStages', {
      centerLabel: 'Total Leads',
      centerValue: '248',
      labels: ['New Inquiry', 'Contacted', 'Counseling', 'Application', 'Enrolled', 'Closed Lost'],
      data:   [82, 54, 38, 24, 42, 8],
      colors: ['#051751', '#006AB3', '#6366F1', '#F59E0B', '#0C4F3E', '#94A3B8']
    });

    // 2. Lead Acquisition Sources
    createDonut('chartAcquisitionSources', {
      centerLabel: 'Inquiries',
      centerValue: '248',
      labels: ['Website Forms', 'Organic Search', 'Social Ads', 'Referral / Alumni', 'Walk-in / Phone'],
      data:   [142, 48, 26, 18, 14],
      colors: ['#0C4F3E', '#006AB3', '#E11D48', '#8B5CF6', '#F59E0B']
    });

    // 3. Course Admissions Share
    createDonut('chartCourseAdmissions', {
      centerLabel: 'Admissions',
      centerValue: '42',
      labels: ['PG Logistics & SCM', 'Professional Diploma', 'Warehouse & Inventory', 'Air Freight', 'Ocean Freight', 'Export-Import'],
      data:   [16, 11, 6, 4, 3, 2],
      colors: ['#0C4F3E', '#051751', '#006AB3', '#10B981', '#F59E0B', '#64748B']
    });

    // 4. Fees Collection Health — INR values
    createDonut('chartFeesHealth', {
      centerLabel: 'Total Value',
      centerValue: '₹17.2L',
      isCurrency: true,
      labels: ['Collected / Paid', 'Outstanding Balance'],
      data:   [1240000, 480000],
      colors: ['#10B981', '#F59E0B']
    });

    // 5. Counselors Team Workload
    createDonut('chartTeamWorkload', {
      centerLabel: 'Leads Handled',
      centerValue: '248',
      labels: ['Anjali Menon', 'Arun Kumar', 'Deepa Varma', 'Rajesh K.', 'Emmanuel P.'],
      data:   [68, 58, 46, 42, 34],
      colors: ['#0C4F3E', '#006AB3', '#6366F1', '#F59E0B', '#10B981']
    });

    // 6. Task Sheet Execution
    createDonut('chartTaskExecution', {
      centerLabel: 'Daily Tasks',
      centerValue: '94',
      labels: ['Done (Completed)', 'In Progress', 'Blocked / Escalated'],
      data:   [82, 10, 2],
      colors: ['#10B981', '#F59E0B', '#EF4444']
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Master Render — called on load, theme-change, resize
  // ─────────────────────────────────────────────────────────────────────────────
  window.renderDashboardCharts = function () {
    initFinancialOverviewChart();
    initAdmissionsPipelineChart();
    initSixAnalyticsDonuts();
  };

  window.addEventListener('scm-theme-changed', () => window.renderDashboardCharts());

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => window.renderDashboardCharts(), 250);
  });

  document.addEventListener('DOMContentLoaded', () => window.renderDashboardCharts());
})();
