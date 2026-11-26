package com.tradevault.app;

import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private SwipeRefreshLayout swipeRefreshLayout;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        ViewGroup parent = (ViewGroup) webView.getParent();
        int index = parent.indexOfChild(webView);
        ViewGroup.LayoutParams layoutParams = webView.getLayoutParams();
        parent.removeView(webView);

        swipeRefreshLayout = new SwipeRefreshLayout(this);
        swipeRefreshLayout.setFitsSystemWindows(true);
        swipeRefreshLayout.setColorSchemeColors(0xFF22C55E, 0xFF3B82F6);
        swipeRefreshLayout.addView(
            webView,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        );
        parent.addView(swipeRefreshLayout, index, layoutParams);

        swipeRefreshLayout.setOnChildScrollUpCallback((parentView, childView) ->
            childView instanceof WebView && ((WebView) childView).getScrollY() > 0
        );
        swipeRefreshLayout.setOnRefreshListener(() -> {
            webView.reload();
            webView.postDelayed(() -> swipeRefreshLayout.setRefreshing(false), 1500);
        });
    }
}
