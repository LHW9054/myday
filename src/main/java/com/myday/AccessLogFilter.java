package com.myday;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/** /api 요청마다 logs/access.log 에 한 줄 (쿼리스트링·본문은 기록하지 않음) */
@Component
public class AccessLogFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger("ACCESS");

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        return !req.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        long t0 = System.nanoTime();
        try {
            chain.doFilter(req, res);
        } finally {
            Object uid = null;
            try {
                HttpSession s = req.getSession(false);
                if (s != null) uid = s.getAttribute("uid");
            } catch (IllegalStateException ignored) {
                // 이미 만료된 세션
            }
            log.info("{} {} -> {} {}ms uid={} ip={}", req.getMethod(), req.getRequestURI(), res.getStatus(),
                    (System.nanoTime() - t0) / 1_000_000, uid == null ? "-" : uid, LoginAudit.ip(req));
        }
    }
}
