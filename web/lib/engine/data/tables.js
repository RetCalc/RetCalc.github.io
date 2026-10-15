/* Figures that don't change with the tax year: the IRS life tables and
   the starting mortgage rate. */

/* IRS Uniform Lifetime Table, Treas. Reg. sec. 1.401(a)(9)-9 (Pub. 590-B
   Table III). These divisors took effect for distribution years from 2022 and
   are unchanged for 2026. */
export const ULT = {72:27.4, 73:26.5, 74:25.5, 75:24.6, 76:23.7, 77:22.9, 78:22.0,
  79:21.1, 80:20.2, 81:19.4, 82:18.5, 83:17.7, 84:16.8, 85:16.0, 86:15.2,
  87:14.4, 88:13.7, 89:12.9, 90:12.2, 91:11.5, 92:10.8, 93:10.1, 94:9.5,
  95:8.9, 96:8.4, 97:7.8, 98:7.3, 99:6.8, 100:6.4};

/* IRS Single Life Table, Treas. Reg. 1.401(a)(9)-9(b), in force from 2022.
   Notice 2022-6 lets 72(t) payments use it, and it gives the shortest life
   expectancy of the three allowed tables, so the largest payment. */
export var BR_SLT = {30:55.3, 31:54.4, 32:53.4, 33:52.5, 34:51.5, 35:50.5, 36:49.6, 37:48.6,
  38:47.7, 39:46.7, 40:45.7, 41:44.8, 42:43.8, 43:42.9, 44:41.9, 45:41.0, 46:40.0,
  47:39.0, 48:38.1, 49:37.1, 50:36.2, 51:35.3, 52:34.3, 53:33.4, 54:32.5, 55:31.6,
  56:30.6, 57:29.8, 58:28.9, 59:28.0};

/* A rounded recent 30-year average -- a reasonable starting point, not a live
   quote. Rates move weekly and this constant is not kept current, so the
   pages describe it as a starting point and ask for the user's own rate. */
export const MORT_RATE_ASOF = "a rounded recent national average, not updated weekly";
export const MORT_RATE_30 = 7.25;
