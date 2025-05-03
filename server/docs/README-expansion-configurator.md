An expansion configurator module will edit a match's configuration before the match
has started. The default export of a configurator module should be a `ExpansionConfiguratorFactory`.

It should return a ComputedMatchConfiguration. The system will continue to run configurations
for every loaded expansion until no new state changes are detected from every configurator.
This allows for re-configuration. If one expansion later adds a kingdom card and a previously
configured expansion would have modified the match based on that card, it now has a chance to.