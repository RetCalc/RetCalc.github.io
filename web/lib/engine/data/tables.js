/* Figures that don't change with the tax year: the IRS life tables, the
   starting mortgage rate and Social Security's average wage index. */

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

/* Social Security's national average wage index, by year, as SSA publishes
   it (ssa.gov/oact/cola/AWI.html, the year before last added each October
   with the next year's figures). Past pay is indexed to wage levels with it:
   a year's earnings times the index two years before the benefit year over
   that year's index, the way the bend points for that year are set. Add the
   new year's figure each October; the tool only starts using it when that
   year's data file (years.js) makes the index year current. */
export const SS_AWI = {
  1951:2799.16, 1952:2973.32, 1953:3139.44, 1954:3155.64, 1955:3301.44, 1956:3532.36,
  1957:3641.72, 1958:3673.80, 1959:3855.80, 1960:4007.12, 1961:4086.76, 1962:4291.40,
  1963:4396.64, 1964:4576.32, 1965:4658.72, 1966:4938.36, 1967:5213.44, 1968:5571.76,
  1969:5893.76, 1970:6186.24, 1971:6497.08, 1972:7133.80, 1973:7580.16, 1974:8030.76,
  1975:8630.92, 1976:9226.48, 1977:9779.44, 1978:10556.03, 1979:11479.46, 1980:12513.46,
  1981:13773.10, 1982:14531.34, 1983:15239.24, 1984:16135.07, 1985:16822.51, 1986:17321.82,
  1987:18426.51, 1988:19334.04, 1989:20099.55, 1990:21027.98, 1991:21811.60, 1992:22935.42,
  1993:23132.67, 1994:23753.53, 1995:24705.66, 1996:25913.90, 1997:27426.00, 1998:28861.44,
  1999:30469.84, 2000:32154.82, 2001:32921.92, 2002:33252.09, 2003:34064.95, 2004:35648.55,
  2005:36952.94, 2006:38651.41, 2007:40405.48, 2008:41334.97, 2009:40711.61, 2010:41673.83,
  2011:42979.61, 2012:44321.67, 2013:44888.16, 2014:46481.52, 2015:48098.63, 2016:48642.15,
  2017:50321.89, 2018:52145.80, 2019:54099.99, 2020:55628.60, 2021:60575.07, 2022:63795.13,
  2023:66621.80, 2024:69846.57, 2025:72800.33};
