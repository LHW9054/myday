package com.myday;

import jakarta.servlet.http.HttpSession;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/insights")
public class InsightController {
    private final InsightService insights;

    public InsightController(InsightService insights) {
        this.insights = insights;
    }

    @GetMapping
    public Map<String, Object> get(@RequestParam String date, @RequestParam(defaultValue = "12") int hour,
                                   @RequestParam(defaultValue = "ko") String lang, HttpSession s) {
        return insights.build(U.uid(s), U.date(date), Math.max(0, Math.min(23, hour)), lang);
    }
}
