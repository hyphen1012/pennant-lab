import StoreKit
import Capacitor

// Real StoreKit 2 boundary, registered in the generated Capacitor controller.
// Verified StoreKit transactions are still not game entitlement authority.
@objc(PennantBillingPlugin)
public class PennantBillingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PennantBillingPlugin"
    public let jsName = "PennantBilling"
    public let pluginMethods: [CAPPluginMethod] = ["product", "purchase", "restore", "finish"].map {
        CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)
    }
    private var active = false
    private var seen: [String: StoreKit.Transaction] = [:]
    private func run(_ call: CAPPluginCall, _ operation: @escaping () async throws -> [String: Any]) {
        Task { @MainActor in
            guard !self.active else { call.reject("billing_busy"); return }
            self.active = true
            defer { self.active = false }
            do { call.resolve(try await operation()) }
            catch { call.reject("billing_unavailable_or_restore_required") }
        }
    }
    private enum BillingError: Error { case invalid }
    private func getProduct(_ call: CAPPluginCall) async throws -> Product {
        guard let id = call.getString("id"), !id.isEmpty, id.count <= 200,
              let product = try await Product.products(for: [id]).first, product.id == id,
              product.type == .nonConsumable || product.type == .autoRenewable
        else { throw BillingError.invalid }
        return product
    }
    @MainActor private func receipt(_ value: VerificationResult<StoreKit.Transaction>) throws -> [String: Any] {
        guard case .verified(let tx) = value else { throw BillingError.invalid }
        let proof = value.jwsRepresentation
        guard !proof.isEmpty, proof.count <= 65536 else { throw BillingError.invalid }
        seen[proof] = tx
        return ["id": tx.productID, "status": "purchased", "store": "apple", "proof": proof]
    }
    @objc func product(_ call: CAPPluginCall) {
        run(call) { let p = try await self.getProduct(call); return ["id":p.id,"formattedPrice":p.displayPrice] }
    }
    @objc func purchase(_ call: CAPPluginCall) {
        run(call) {
            let p = try await self.getProduct(call)
            guard call.getBool("confirmed") == true, call.getString("confirmedPrice") == p.displayPrice,
                  let account = call.getString("account"), let token = UUID(uuidString:account)
            else { throw BillingError.invalid }
            switch try await p.purchase(options:[.appAccountToken(token)]) {
            case .success(let v): return try await self.receipt(v)
            case .pending: return ["status":"pending"]
            case .userCancelled: return ["status":"cancelled"]
            @unknown default: throw BillingError.invalid
            }
        }
    }
    @objc func restore(_ call: CAPPluginCall) {
        run(call) {
            // User-initiated restore only; unfinished and current entitlements
            // are deduplicated by the signed transaction representation.
            try await AppStore.sync()
            var rows: [[String: Any]] = [], keys = Set<String>()
            for await v in StoreKit.Transaction.currentEntitlements {
                let r = try await self.receipt(v)
                if let proof = r["proof"] as? String, keys.insert(proof).inserted { rows.append(r) }
            }
            for await v in StoreKit.Transaction.unfinished {
                let r = try await self.receipt(v)
                if let proof = r["proof"] as? String, keys.insert(proof).inserted { rows.append(r) }
            }
            return ["rows":rows]
        }
    }
    @objc func finish(_ call: CAPPluginCall) {
        run(call) {
            guard let proof = call.getString("proof"), let tx = await self.seen[proof] else { throw BillingError.invalid }
            await tx.finish()
            return [:]
        }
    }
}

@objc(PennantBillingViewController)
class PennantBillingViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PennantBillingPlugin())
    }
}
