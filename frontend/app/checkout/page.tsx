'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, CreditCard, Truck, ArrowLeft, Lock } from 'lucide-react';

const API = typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api');

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  tax_rate?: number;
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<'review' | 'info' | 'payment'>('review');
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  const [payMethod, setPayMethod] = useState<'cod' | 'card'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('checkout_cart');
      if (raw) {
        const items = JSON.parse(raw) as CartItem[];
        if (items.length) { setCart(items); return; }
      }
    } catch {}
    router.push('/');
  }, [router]);

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const taxTotal = cart.reduce((s, c) => {
    const rate = c.tax_rate || 0;
    return s + Math.round(c.price * c.quantity * (rate / 100) * 100) / 100;
  }, 0);
  const total = Math.round((subtotal + taxTotal) * 100) / 100;

  const canGoInfo = cart.length > 0;
  const canGoPayment = name.trim() && email.trim() && phone.trim() && line1.trim() && city.trim() && state && zip.trim();
  const canSubmit = payMethod === 'cod' || (cardNumber.replace(/\s/g, '').length >= 15 && cardExpiry.length >= 4 && cardCvc.length >= 3 && cardName.trim());

  const formatCard = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };
  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/online-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((c) => ({ product_id: c.id, quantity: c.quantity, price: c.price })),
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          address_line1: line1,
          address_line2: line2,
          city,
          state,
          zip,
          country: 'US',
          payment_method: payMethod,
          card_last4: payMethod === 'card' ? cardNumber.replace(/\s/g, '').slice(-4) : undefined,
          card_brand: payMethod === 'card' ? 'Visa' : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      localStorage.removeItem('checkout_cart');
      router.push(`/order-confirmation?order=${data.order_number}`);
    } catch (err: any) {
      alert(err.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  const stepClass = (s: string) =>
    `flex items-center gap-2 text-sm font-medium ${step === s ? 'text-[#0f766e]' : 'text-gray-400'}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to store
          </button>
          <span className="font-semibold text-gray-900">Express Distributors</span>
          <Lock className="w-4 h-4 text-gray-400" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Steps */}
        <div className="flex items-center gap-6 mb-8 border-b pb-4">
          <button onClick={() => setStep('review')} className={stepClass('review')}>
            <ShoppingBag className="w-4 h-4" /> 1. Review
          </button>
          <div className="w-8 h-px bg-gray-300" />
          <button onClick={() => canGoInfo && setStep('info')} className={stepClass('info')} disabled={!canGoInfo}>
            <Truck className="w-4 h-4" /> 2. Shipping
          </button>
          <div className="w-8 h-px bg-gray-300" />
          <button onClick={() => canGoPayment && setStep('payment')} className={stepClass('payment')} disabled={!canGoPayment}>
            <CreditCard className="w-4 h-4" /> 3. Payment
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main area */}
          <div className="lg:col-span-2 space-y-6">

            {/* Step 1: Review */}
            {step === 'review' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold mb-4">Order Review</h2>
                {cart.length === 0 ? (
                  <p className="text-gray-500">Your cart is empty.</p>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-3 border-b last:border-0">
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-500">Qty: {item.quantity} × ${item.price.toFixed(2)}</p>
                          {(item.tax_rate || 0) > 0 && (
                            <p className="text-xs text-gray-400">Tax: {item.tax_rate}%</p>
                          )}
                        </div>
                        <p className="font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setStep('info')}
                  disabled={!canGoInfo}
                  className="mt-6 w-full py-3 bg-[#0f766e] text-white font-medium rounded-lg hover:bg-[#0d5d57] disabled:opacity-50"
                >
                  Continue to Shipping
                </button>
              </div>
            )}

            {/* Step 2: Customer & Address */}
            {step === 'info' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full name *</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2.5" placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded-lg px-3 py-2.5" placeholder="john@example.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border rounded-lg px-3 py-2.5" placeholder="(555) 123-4567" />
                  </div>
                </div>

                <h3 className="text-md font-semibold mt-6 mb-3">Shipping Address</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Street address *</label>
                    <input value={line1} onChange={(e) => setLine1(e.target.value)} className="w-full border rounded-lg px-3 py-2.5" placeholder="123 Main Street" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Apt / Suite / Unit</label>
                    <input value={line2} onChange={(e) => setLine2(e.target.value)} className="w-full border rounded-lg px-3 py-2.5" placeholder="Apt 4B" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full border rounded-lg px-3 py-2.5" placeholder="New York" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                    <select value={state} onChange={(e) => setState(e.target.value)} className="w-full border rounded-lg px-3 py-2.5">
                      <option value="">Select state</option>
                      {US_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP code *</label>
                    <input value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))} className="w-full border rounded-lg px-3 py-2.5" placeholder="10001" />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setStep('review')} className="px-4 py-2.5 border rounded-lg text-gray-700 hover:bg-gray-50">Back</button>
                  <button
                    onClick={() => setStep('payment')}
                    disabled={!canGoPayment}
                    className="flex-1 py-2.5 bg-[#0f766e] text-white font-medium rounded-lg hover:bg-[#0d5d57] disabled:opacity-50"
                  >
                    Continue to Payment
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Payment */}
            {step === 'payment' && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold mb-4">Payment Method</h2>
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={() => setPayMethod('card')}
                    className={`flex-1 py-3 border-2 rounded-lg font-medium text-sm transition-colors ${payMethod === 'card' ? 'border-[#0f766e] bg-teal-50 text-[#0f766e]' : 'border-gray-200 text-gray-500'}`}
                  >
                    <CreditCard className="w-5 h-5 mx-auto mb-1" /> Credit / Debit Card
                  </button>
                  <button
                    onClick={() => setPayMethod('cod')}
                    className={`flex-1 py-3 border-2 rounded-lg font-medium text-sm transition-colors ${payMethod === 'cod' ? 'border-[#0f766e] bg-teal-50 text-[#0f766e]' : 'border-gray-200 text-gray-500'}`}
                  >
                    <Truck className="w-5 h-5 mx-auto mb-1" /> Cash on Delivery
                  </button>
                </div>

                {payMethod === 'card' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name on card *</label>
                      <input value={cardName} onChange={(e) => setCardName(e.target.value)} className="w-full border rounded-lg px-3 py-2.5" placeholder="John Doe" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Card number *</label>
                      <input value={cardNumber} onChange={(e) => setCardNumber(formatCard(e.target.value))} className="w-full border rounded-lg px-3 py-2.5 font-mono tracking-wider" placeholder="4242 4242 4242 4242" maxLength={19} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Expiry *</label>
                        <input value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} className="w-full border rounded-lg px-3 py-2.5 font-mono" placeholder="MM/YY" maxLength={5} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CVC *</label>
                        <input value={cardCvc} onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full border rounded-lg px-3 py-2.5 font-mono" placeholder="123" maxLength={4} />
                      </div>
                    </div>
                  </div>
                )}

                {payMethod === 'cod' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                    Pay with cash when your order is delivered. Please have the exact amount ready.
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setStep('info')} className="px-4 py-2.5 border rounded-lg text-gray-700 hover:bg-gray-50">Back</button>
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit || submitting}
                    className="flex-1 py-2.5 bg-[#0f766e] text-white font-medium rounded-lg hover:bg-[#0d5d57] disabled:opacity-50"
                  >
                    {submitting ? 'Placing order…' : `Place Order — $${total.toFixed(2)}`}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border p-6 sticky top-20">
              <h3 className="font-semibold mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm mb-4">
                {cart.map((c) => (
                  <div key={c.id} className="flex justify-between">
                    <span className="text-gray-600 truncate mr-2">{c.name} × {c.quantity}</span>
                    <span className="font-medium shrink-0">${(c.price * c.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Tax</span><span>${taxTotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Shipping</span><span className="text-green-600">Free</span></div>
              </div>
              <div className="border-t mt-3 pt-3 flex justify-between font-semibold text-lg">
                <span>Total</span><span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
