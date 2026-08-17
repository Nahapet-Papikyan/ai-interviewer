type Props = {
  firstName: string;
  denied: boolean;
  connecting: boolean;
  onEnable: () => void;
  onTextOnly: () => void;
};

export function MicPrompt({ firstName, denied, connecting, onEnable, onTextOnly }: Props) {
  if (denied) {
    return (
      <div className="mx-auto max-w-sm px-2 text-center">
        <p className="text-base font-medium text-zinc-900">Խոսափողը արգելափակված է</p>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Բացեք կայքի կարգավորումները հասցեի տողում, թույլատրեք խոսափողը, ապա սեղմեք կրկին փորձել։ Կարող եք նաև շարունակել տեքստով։
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button className="btn h-11 px-4" type="button" onClick={onEnable}>
            Կրկին փորձել
          </button>
          <button className="btn-secondary h-11 px-4" type="button" onClick={onTextOnly}>
            Շարունակել տեքստով
          </button>
        </div>
      </div>
    );
  }

  if (connecting) {
    return (
      <div className="mx-auto max-w-sm px-2 text-center">
        <p className="text-base font-medium text-zinc-900">Թույլատրեք խոսափողը</p>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Եթե զննարկիչը հարցնում է վերևում, սեղմեք Allow։ Խոսափողը միայն հարցազրույցի ընթացքում է օգտագործվում, հում ձայն չի պահվում։
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-2 text-center">
      <p className="text-base font-medium text-zinc-900">Պատրաստ ենք սկսել, {firstName}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">
        Սեղմեք խոսափողի կոճակը կամ ներքևի կոճակը։ Զննարկիչը կհարցնի թույլտվություն, որպեսզի կարողանաք խոսել հայերեն։
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button className="btn h-11 px-4" type="button" onClick={onEnable}>
          Միացնել խոսափողը
        </button>
        <button className="btn-secondary h-11 px-4" type="button" onClick={onTextOnly}>
          Շարունակել տեքստով
        </button>
      </div>
    </div>
  );
}
