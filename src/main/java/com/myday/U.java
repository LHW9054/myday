package com.myday;

import jakarta.servlet.http.HttpSession;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 작은 유틸 모음 */
public final class U {
    private U() {}

    public static final ZoneId TOKYO = ZoneId.of("Asia/Tokyo");

    public static long uid(HttpSession s) {
        Object o = s.getAttribute("uid");
        if (o == null) throw new ApiException(401, "로그인이 필요해요.");
        return (Long) o;
    }

    public static LocalDate date(String s) {
        try {
            return LocalDate.parse(s);
        } catch (Exception e) {
            throw new ApiException(400, "날짜 형식이 올바르지 않아요.");
        }
    }

    /** JDBC 가 돌려주는 DATE 값(java.sql.Date 등)을 LocalDate 로 */
    public static LocalDate ld(Object o) {
        if (o instanceof java.sql.Date d) return d.toLocalDate();
        if (o instanceof LocalDate l) return l;
        return LocalDate.parse(String.valueOf(o).substring(0, 10));
    }

    public static boolean bool(Object o) {
        if (o instanceof Boolean b) return b;
        if (o instanceof Number n) return n.intValue() != 0;
        return o != null && "true".equalsIgnoreCase(String.valueOf(o));
    }

    public static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    public static int num(Object o, int def) {
        if (o instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(o).trim());
        } catch (Exception e) {
            return def;
        }
    }

    public static Map<String, Object> m(Object... kv) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) map.put((String) kv[i], kv[i + 1]);
        return map;
    }

    public static double dbl(Object o, double def) {
        if (o instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(o).trim());
        } catch (Exception e) {
            return def;
        }
    }

    /** SQL 에서 'xxx AS dt' 로 가져온 DATE 를 문자열 date 필드로 바꿔 준다 */
    public static List<Map<String, Object>> fixDates(List<Map<String, Object>> rows) {
        rows.forEach(r -> r.put("date", ld(r.remove("dt")).toString()));
        return rows;
    }

    public static boolean ja(String lang) {
        return "ja".equalsIgnoreCase(lang);
    }
}
