package __APP_PACKAGE__;

import android.os.Handler;
import android.os.Looper;
import com.android.billingclient.api.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.*;
import org.json.JSONObject;

// Real Play Billing SDK boundary. Never grants game rights. No consume path.
@CapacitorPlugin(name="PennantBilling")
public class PennantBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    // Keep real transactions disabled until provider end-to-end tests pass.
    private static final boolean TRANSACTIONS_ENABLED=false;
    private BillingClient client;
    private final Handler main = new Handler(Looper.getMainLooper());
    private PluginCall active;
    private String purchaseId;
    private Runnable timeout;
    private final Map<String, Purchase> seen = new HashMap<>();

    private boolean ok(BillingResult r) { return r.getResponseCode() == BillingClient.BillingResponseCode.OK; }
    private void done(PluginCall call, JSObject data) {
        if (active != call) return;
        if (timeout != null) main.removeCallbacks(timeout);
        active = null; purchaseId = null; timeout = null; call.resolve(data);
    }
    private void fail(PluginCall call, String code) {
        if (active != call) return;
        if (timeout != null) main.removeCallbacks(timeout);
        active = null; purchaseId = null; timeout = null; call.reject(code);
    }
    private void begin(PluginCall call, Runnable action) {
        main.post(() -> {
            if (active != null) { call.reject("billing_busy"); return; }
            active = call;
            timeout = () -> fail(call, "billing_result_unknown_restore_required");
            main.postDelayed(timeout, 180000);
            try {
                if (client == null) client = BillingClient.newBuilder(getContext())
                    .setListener(this).enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                    .enableAutoServiceReconnection().build();
                if (client.isReady()) { action.run(); return; }
                client.startConnection(new BillingClientStateListener() {
                    public void onBillingSetupFinished(BillingResult result) { main.post(() -> {
                        if (active != call) return;
                        if (ok(result)) action.run(); else fail(call, "billing_unavailable");
                    }); }
                    public void onBillingServiceDisconnected() { }
                });
            } catch (Exception e) { fail(call, "billing_unavailable"); }
        });
    }
    private static class Offer {
        final ProductDetails product; final String token, price;
        Offer(ProductDetails p, String t, String v) { product=p; token=t; price=v; }
    }
    private interface OfferCallback { void accept(Offer offer); }
    private void findOffer(PluginCall call, OfferCallback next) {
        String id=call.getString("id"), type=call.getString("type"), plan=call.getString("basePlan");
        if (id==null || id.isEmpty() || id.length()>200 || !("inapp".equals(type)||"subs".equals(type))) { fail(call,"invalid_product");return; }
        QueryProductDetailsParams.Product p=QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(type).build();
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(p)).build(),(result,response)->main.post(()->{
            if(active!=call)return;
            if(!ok(result)||response.getProductDetailsList().size()!=1){fail(call,"product_unavailable");return;}
            ProductDetails d=response.getProductDetailsList().get(0);
            if(!id.equals(d.getProductId())){fail(call,"product_mismatch");return;}
            if("inapp".equals(type)){
                List<ProductDetails.OneTimePurchaseOfferDetails> offers=d.getOneTimePurchaseOfferDetailsList();
                if(offers==null||offers.size()!=1){fail(call,"ambiguous_offer");return;}
                ProductDetails.OneTimePurchaseOfferDetails o=offers.get(0);
                next.accept(new Offer(d,o.getOfferToken(),o.getFormattedPrice()));return;
            }
            List<ProductDetails.SubscriptionOfferDetails> offers=d.getSubscriptionOfferDetails();
            if(plan==null||offers==null){fail(call,"base_plan_required");return;}
            List<ProductDetails.SubscriptionOfferDetails> selected=new ArrayList<>();
            for(ProductDetails.SubscriptionOfferDetails o:offers)if(plan.equals(o.getBasePlanId())&&o.getOfferId()==null)selected.add(o);
            if(selected.size()!=1){fail(call,"base_plan_unavailable");return;}
            ProductDetails.SubscriptionOfferDetails o=selected.get(0);
            List<ProductDetails.PricingPhase> phases=o.getPricingPhases().getPricingPhaseList();
            if(phases.size()!=1){fail(call,"complex_pricing_unavailable");return;}
            next.accept(new Offer(d,o.getOfferToken(),phases.get(0).getFormattedPrice()));
        }));
    }
    @PluginMethod public void product(PluginCall call){begin(call,()->findOffer(call,o->{
        JSObject r=new JSObject();r.put("id",o.product.getProductId());r.put("formattedPrice",o.price);done(call,r);
    }));}
    @PluginMethod public void purchase(PluginCall call){if(!TRANSACTIONS_ENABLED){call.reject("billing_not_enabled");return;}begin(call,()->findOffer(call,o->{
        String account=call.getString("account"),price=call.getString("confirmedPrice");
        if(account==null||!account.matches("[a-f0-9]{64}")||!o.price.equals(price)||!Boolean.TRUE.equals(call.getBoolean("confirmed"))){fail(call,"confirmation_required");return;}
        BillingFlowParams.ProductDetailsParams.Builder b=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(o.product);
        if(o.token!=null&&!o.token.isEmpty())b.setOfferToken(o.token);
        purchaseId=o.product.getProductId();
        BillingResult r=client.launchBillingFlow(getActivity(),BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(Collections.singletonList(b.build())).setObfuscatedAccountId(account).build());
        if(!ok(r)){fail(call,"purchase_not_started");}
    }));}
    private JSObject record(Purchase p,String id){
        JSObject r=new JSObject();r.put("store","google");r.put("id",id);
        boolean purchased=p.getPurchaseState()==Purchase.PurchaseState.PURCHASED;
        r.put("status",purchased?"purchased":"pending");
        if(purchased){r.put("proof",p.getPurchaseToken());seen.put(p.getPurchaseToken(),p);}
        return r;
    }
    @Override public void onPurchasesUpdated(BillingResult result,List<Purchase> purchases){main.post(()->{
        PluginCall call=active;String id=purchaseId;if(call==null||id==null)return;
        if(result.getResponseCode()==BillingClient.BillingResponseCode.USER_CANCELED){JSObject r=new JSObject();r.put("status","cancelled");done(call,r);return;}
        if(!ok(result)||purchases==null){fail(call,"purchase_result_unknown_restore_required");return;}
        for(Purchase p:purchases)if(p.getProducts().contains(id)){done(call,record(p,id));return;}
        fail(call,"purchase_result_unknown_restore_required");
    });}
    private void query(PluginCall call,String type,JSArray rows,Runnable next){
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(type).build(),(r,ps)->main.post(()->{
            if(active!=call)return;
            if(!ok(r)){fail(call,"restore_unavailable");return;}
            for(Purchase p:ps)for(String id:p.getProducts())rows.put(record(p,id));
            next.run();
        }));
    }
    @PluginMethod public void restore(PluginCall call){begin(call,()->{
        JSArray rows=new JSArray();query(call,BillingClient.ProductType.INAPP,rows,()->query(call,BillingClient.ProductType.SUBS,rows,()->{
            JSObject r=new JSObject();r.put("rows",rows);done(call,r);
        }));
    });}
    // Invoke only after server verifies this specific purchase. Native ack is
    // not entitlement authority; the server remains the source of paid rights.
    @PluginMethod public void finish(PluginCall call){if(!TRANSACTIONS_ENABLED){call.reject("billing_not_enabled");return;}begin(call,()->{
        String proof=call.getString("proof");Purchase p=seen.get(proof);
        if(p==null||p.getPurchaseState()!=Purchase.PurchaseState.PURCHASED){fail(call,"unknown_purchase");return;}
        if(p.isAcknowledged()){done(call,new JSObject());return;}
        client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(proof).build(),r->main.post(()->{
            if(active!=call)return;if(ok(r))done(call,new JSObject());else fail(call,"acknowledgement_pending");
        }));
    });}
}
