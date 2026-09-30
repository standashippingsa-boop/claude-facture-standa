package com.standacommercialsa.agence;

import android.content.Context;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * Standa Agence — impression du ticket de remise.
 *
 * Dans une WebView Android, window.print() ne fait rien. Le site appelle donc
 * window.StandaPrint.print(nom) (lib/print.ts) : on ouvre le service
 * d'impression Android sur la page affichée, avec ses styles @media print
 * (seul le ticket sort, à la largeur du rouleau 80 mm / 58 mm). L'imprimante
 * thermique doit avoir son service d'impression Android installé (ou choisir
 * « Enregistrer en PDF »).
 *
 * Le pont n'expose QUE cette méthode d'impression : aucune donnée n'en sort.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        webView.addJavascriptInterface(new PrintBridge(webView), "StandaPrint");
    }

    private class PrintBridge {
        private final WebView webView;

        PrintBridge(WebView webView) {
            this.webView = webView;
        }

        @JavascriptInterface
        public void print(final String jobName) {
            runOnUiThread(() -> {
                PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                if (printManager == null) return;
                String name = (jobName == null || jobName.trim().isEmpty()) ? "Ticket STANDA" : jobName.trim();
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(name);
                PrintAttributes attributes = new PrintAttributes.Builder()
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build();
                printManager.print(name, adapter, attributes);
            });
        }
    }
}
